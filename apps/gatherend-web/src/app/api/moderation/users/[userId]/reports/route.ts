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

const REPORT_SCOPES = ["against", "filed", "all"] as const;

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
    const scope = searchParams.get("scope") || "against";

    if (!REPORT_SCOPES.includes(scope as (typeof REPORT_SCOPES)[number])) {
      return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
    }

    const relationFilter =
      scope === "all"
        ? {
            OR: [{ reporterId: profileId }, { targetOwnerId: profileId }],
          }
        : scope === "filed"
          ? { reporterId: profileId }
          : { targetOwnerId: profileId };

    const reports = await db.report.findMany({
      where: {
        AND: [
          relationFilter,
          ...(cursor
            ? [
                {
                  OR: [
                    { createdAt: { lt: cursor.createdAt } },
                    {
                      AND: [
                        { createdAt: cursor.createdAt },
                        { id: { lt: cursor.id } },
                      ],
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      include: {
        reporter: {
          select: moderationProfileSelect,
        },
        targetOwner: {
          select: moderationProfileSelect,
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const hasMore = reports.length > limit;
    const items = hasMore ? reports.slice(0, limit) : reports;
    const lastItem = items.length > 0 ? items[items.length - 1] : null;
    const nextCursor =
      hasMore && lastItem
        ? buildDateCursor({
            createdAt: lastItem.createdAt,
            id: lastItem.id,
          })
        : null;

    return NextResponse.json({
      scope,
      items: items.map((report) => ({
        id: report.id,
        targetType: report.targetType,
        targetId: report.targetId,
        boardId: report.boardId,
        channelId: report.channelId,
        category: report.category,
        status: report.status,
        priority: report.priority,
        description: report.description,
        createdAt: report.createdAt.toISOString(),
        relationType:
          report.reporterId === profileId ? "FILED" : "AGAINST",
        reporter: serializeModerationProfile(report.reporter),
        targetOwner: serializeModerationProfile(report.targetOwner),
        snapshot: report.snapshot as Record<string, unknown>,
      })),
      nextCursor,
      hasMore,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CURSOR") {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }

    console.error("[MODERATION_USER_REPORTS]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
