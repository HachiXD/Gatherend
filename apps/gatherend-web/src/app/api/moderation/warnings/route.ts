import { NextResponse } from "next/server";
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

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rateLimitResponse = await checkRateLimit(RATE_LIMITS.moderationRead);
  if (rateLimitResponse) return rateLimitResponse;

  const admin = await requireAdmin();
  if (!admin.success) return admin.response;

  try {
    const { searchParams } = new URL(req.url);
    const cursor = parseDateCursor(searchParams.get("cursor"));
    const limit = getSafeCursorLimit(searchParams.get("limit"));
    const profileId = searchParams.get("profileId");

    if (profileId && !UUID_REGEX.test(profileId)) {
      return NextResponse.json({ error: "Invalid profile ID" }, { status: 400 });
    }

    const where = {
      ...(profileId ? { profileId } : {}),
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
    };

    const warnings = await db.platformWarning.findMany({
      where,
      include: {
        profile: {
          select: moderationProfileSelect,
        },
        issuedBy: {
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
        removedBy: {
          select: moderationProfileSelect,
        },
        promotedToStrike: {
          select: {
            id: true,
            severity: true,
            sourceType: true,
            createdAt: true,
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

    const serializedItems = items.map((warning) => ({
      ...warning,
      profile: serializeModerationProfile(warning.profile),
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
    }));

    return NextResponse.json({
      items: serializedItems,
      warnings: serializedItems,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CURSOR") {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }

    console.error("[MODERATION_WARNINGS]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
