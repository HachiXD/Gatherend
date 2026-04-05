import { NextResponse } from "next/server";
import {
  PlatformBanSourceType,
  PlatformModerationActionType,
} from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  UUID_REGEX,
  invalidateModeratedProfileCaches,
  revokeBetterAuthSessions,
} from "@/lib/platform-moderation";

export const dynamic = "force-dynamic";

function isValidOptionalString(
  value: unknown,
  maxLength: number,
): value is string | undefined {
  return (
    value === undefined || (typeof value === "string" && value.length <= maxLength)
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const rateLimitResponse = await checkRateLimit(RATE_LIMITS.moderation);
  if (rateLimitResponse) return rateLimitResponse;

  const admin = await requireAdmin();
  if (!admin.success) return admin.response;

  const { userId: profileId } = await params;

  if (!profileId || !UUID_REGEX.test(profileId)) {
    return NextResponse.json(
      { error: "Invalid profile ID format" },
      { status: 400 },
    );
  }

  if (profileId === admin.profile.id) {
    return NextResponse.json(
      { error: "Cannot perform moderation actions on yourself" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { reason, notes } = (body ?? {}) as {
    reason?: unknown;
    notes?: unknown;
  };

  if (!isValidOptionalString(reason, 500)) {
    return NextResponse.json(
      { error: "Reason must be 500 characters or less" },
      { status: 400 },
    );
  }

  if (!isValidOptionalString(notes, 2000)) {
    return NextResponse.json(
      { error: "Notes must be 2000 characters or less" },
      { status: 400 },
    );
  }

  try {
    const targetProfile = await db.profile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        userId: true,
        banned: true,
      },
    });

    if (!targetProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetProfile.banned) {
      return NextResponse.json(
        { error: "User is already banned", alreadyBanned: true },
        { status: 409 },
      );
    }

    const banReason = reason?.trim() || "Banned by moderator";

    await db.$transaction(async (tx) => {
      await tx.profile.update({
        where: { id: targetProfile.id },
        data: {
          banned: true,
          bannedAt: new Date(),
          banReason,
          banSourceType: PlatformBanSourceType.MANUAL,
        },
      });

      await tx.platformModerationAction.create({
        data: {
          profileId: targetProfile.id,
          issuedById: admin.profile.id,
          actionType: PlatformModerationActionType.BAN,
          notes: notes?.trim() || banReason,
        },
      });
    });

    await invalidateModeratedProfileCaches(targetProfile);
    await revokeBetterAuthSessions(targetProfile.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[MODERATION_USER_BAN]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const rateLimitResponse = await checkRateLimit(RATE_LIMITS.moderation);
  if (rateLimitResponse) return rateLimitResponse;

  const admin = await requireAdmin();
  if (!admin.success) return admin.response;

  const { userId: profileId } = await params;

  if (!profileId || !UUID_REGEX.test(profileId)) {
    return NextResponse.json(
      { error: "Invalid profile ID format" },
      { status: 400 },
    );
  }

  let notes: string | undefined;
  if (req.headers.get("content-length") && req.headers.get("content-length") !== "0") {
    try {
      const body = (await req.json()) as { notes?: unknown };
      if (!isValidOptionalString(body.notes, 2000)) {
        return NextResponse.json(
          { error: "Notes must be 2000 characters or less" },
          { status: 400 },
        );
      }
      notes = body.notes;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  }

  try {
    const targetProfile = await db.profile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        userId: true,
        banned: true,
      },
    });

    if (!targetProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!targetProfile.banned) {
      return NextResponse.json(
        { error: "User is not banned", alreadyUnbanned: true },
        { status: 409 },
      );
    }

    await db.$transaction(async (tx) => {
      await tx.profile.update({
        where: { id: targetProfile.id },
        data: {
          banned: false,
          bannedAt: null,
          banReason: null,
          banSourceType: null,
        },
      });

      await tx.platformModerationAction.create({
        data: {
          profileId: targetProfile.id,
          issuedById: admin.profile.id,
          actionType: PlatformModerationActionType.UNBAN,
          notes: notes?.trim() || null,
        },
      });
    });

    await invalidateModeratedProfileCaches(targetProfile);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[MODERATION_USER_UNBAN]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
