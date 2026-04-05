import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  issuePlatformWarning,
  UUID_REGEX,
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

  const { reason, notes, reportId } = (body ?? {}) as {
    reason?: unknown;
    notes?: unknown;
    reportId?: unknown;
  };

  if (typeof reason !== "string" || reason.trim().length === 0 || reason.length > 500) {
    return NextResponse.json(
      { error: "Reason is required and must be 500 characters or less" },
      { status: 400 },
    );
  }

  if (!isValidOptionalString(notes, 2000)) {
    return NextResponse.json(
      { error: "Notes must be 2000 characters or less" },
      { status: 400 },
    );
  }

  if (
    reportId !== undefined &&
    (typeof reportId !== "string" || reportId.length === 0 || reportId.length > 191)
  ) {
    return NextResponse.json({ error: "Invalid report ID" }, { status: 400 });
  }

  try {
    const [targetProfile, report] = await Promise.all([
      db.profile.findUnique({
        where: { id: profileId },
        select: { id: true },
      }),
      reportId
        ? db.report.findUnique({
            where: { id: reportId },
            select: { id: true, targetOwnerId: true },
          })
        : Promise.resolve(null),
    ]);

    if (!targetProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (reportId && (!report || report.targetOwnerId !== targetProfile.id)) {
      return NextResponse.json(
        { error: "Report does not belong to this user" },
        { status: 400 },
      );
    }

    const result = await db.$transaction(async (tx) =>
      issuePlatformWarning(tx, {
        profileId: targetProfile.id,
        issuedById: admin.profile.id,
        reportId: report?.id ?? null,
        reason: reason.trim(),
        notes: notes?.trim() || null,
      }),
    );

    return NextResponse.json({
      success: true,
      warning: {
        ...result.warning,
        createdAt: result.warning.createdAt.toISOString(),
        updatedAt: result.warning.updatedAt.toISOString(),
        removedAt: result.warning.removedAt?.toISOString() ?? null,
      },
      promotedStrikeIds: result.promotedStrikeIds,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PROFILE_NOT_FOUND") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.error("[MODERATION_USER_WARNING_CREATE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
