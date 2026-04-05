import { NextResponse } from "next/server";
import { PlatformWarningStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  buildDateCursor,
  getSafeCursorLimit,
  parseDateCursor,
  UUID_REGEX,
} from "@/lib/platform-moderation";
import {
  moderationProfileSelect,
  serializeModerationProfile,
} from "@/lib/moderation-serialization";

const WARNING_STATUS_FILTERS = [
  "all",
  ...Object.values(PlatformWarningStatus),
] as const;

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const rateLimitResponse = await checkRateLimit(RATE_LIMITS.moderationRead);
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

  try {
    const { searchParams } = new URL(req.url);
    const cursor = parseDateCursor(searchParams.get("cursor"));
    const limit = getSafeCursorLimit(searchParams.get("limit"));
    const status = searchParams.get("status") || "all";

    if (
      !WARNING_STATUS_FILTERS.includes(
        status as (typeof WARNING_STATUS_FILTERS)[number],
      )
    ) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const warnings = await db.platformWarning.findMany({
      where: {
        profileId,
        ...(status !== "all"
          ? { status: status as PlatformWarningStatus }
          : {}),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                {
                  AND: [{ createdAt: cursor.createdAt }, { id: { lt: cursor.id } }],
                },
              ],
            }
          : {}),
      },
      include: {
        issuedBy: {
          select: moderationProfileSelect,
        },
        removedBy: {
          select: moderationProfileSelect,
        },
        report: {
          select: {
            id: true,
            category: true,
            targetType: true,
            status: true,
            createdAt: true,
          },
        },
        promotedToStrike: {
          select: {
            id: true,
            severity: true,
            reason: true,
            createdAt: true,
            sourceType: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const hasMore = warnings.length > limit;
    const items = hasMore ? warnings.slice(0, limit) : warnings;
    const lastItem = items.length > 0 ? items[items.length - 1] : null;
    const nextCursor =
      hasMore && lastItem
        ? buildDateCursor({
            createdAt: lastItem.createdAt,
            id: lastItem.id,
          })
        : null;

    return NextResponse.json({
      items: items.map((warning) => ({
        ...warning,
        issuedBy: serializeModerationProfile(warning.issuedBy),
        removedBy: serializeModerationProfile(warning.removedBy),
        createdAt: warning.createdAt.toISOString(),
        updatedAt: warning.updatedAt.toISOString(),
        removedAt: warning.removedAt?.toISOString() ?? null,
        report: warning.report
          ? {
              ...warning.report,
              createdAt: warning.report.createdAt.toISOString(),
            }
          : null,
        promotedToStrike: warning.promotedToStrike
          ? {
              ...warning.promotedToStrike,
              createdAt: warning.promotedToStrike.createdAt.toISOString(),
            }
          : null,
      })),
      nextCursor,
      hasMore,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CURSOR") {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }

    console.error("[MODERATION_USER_WARNINGS]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
