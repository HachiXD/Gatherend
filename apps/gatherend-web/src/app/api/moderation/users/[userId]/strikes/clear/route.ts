import { NextResponse } from "next/server";
import {
  PlatformModerationActionType,
  StrikeSourceType,
} from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  getRevertedReputationDeltaForStrikeSeverity,
  syncPlatformAutoBanState,
  UUID_REGEX,
} from "@/lib/platform-moderation";
import { adjustProfileReputation } from "@/lib/domain";

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
    const profile = await db.profile.findUnique({
      where: { id: profileId },
      select: { id: true },
    });

    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const result = await db.$transaction(async (tx) => {
      const directStrikes = await tx.strike.findMany({
        where: {
          profileId: profile.id,
          sourceType: StrikeSourceType.DIRECT,
        },
        select: {
          id: true,
          severity: true,
        },
      });

      if (directStrikes.length === 0) {
        throw new Error("NO_STRIKES");
      }

      const reputationDelta = directStrikes.reduce(
        (sum, strike) =>
          sum + getRevertedReputationDeltaForStrikeSeverity(strike.severity),
        0,
      );

      if (reputationDelta !== 0) {
        await adjustProfileReputation(tx, {
          profileId: profile.id,
          delta: reputationDelta,
          reason: "CLEAR_STRIKES",
          sourceType: "ADMIN",
          sourceId: profile.id,
        });
      }

      await tx.platformModerationAction.create({
        data: {
          profileId: profile.id,
          issuedById: admin.profile.id,
          actionType: PlatformModerationActionType.CLEAR_STRIKES,
          notes: notes?.trim() || `Cleared ${directStrikes.length} direct strikes`,
        },
      });

      await tx.strike.deleteMany({
        where: {
          id: { in: directStrikes.map((strike) => strike.id) },
        },
      });

      const autoBanResult = await syncPlatformAutoBanState(tx, {
        profileId: profile.id,
        issuedById: admin.profile.id,
        notes: notes?.trim() || null,
      });

      return {
        clearedCount: directStrikes.length,
        autoBanned: autoBanResult.autoBanned,
        autoUnbanned: autoBanResult.autoUnbanned,
      };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "NO_STRIKES") {
      return NextResponse.json(
        { error: "User has no strikes to clear" },
        { status: 409 },
      );
    }

    console.error("[MODERATION_USER_CLEAR_STRIKES]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
