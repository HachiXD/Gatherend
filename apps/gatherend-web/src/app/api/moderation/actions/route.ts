import { NextResponse } from "next/server";
import { PlatformModerationActionType } from "@prisma/client";
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

const ACTION_FILTERS = ["all", ...Object.values(PlatformModerationActionType)] as const;

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
    const actionType = searchParams.get("actionType") || "all";
    const profileId = searchParams.get("profileId");

    if (!ACTION_FILTERS.includes(actionType as (typeof ACTION_FILTERS)[number])) {
      return NextResponse.json({ error: "Invalid actionType" }, { status: 400 });
    }

    if (profileId && !UUID_REGEX.test(profileId)) {
      return NextResponse.json({ error: "Invalid profile ID" }, { status: 400 });
    }

    const where = {
      ...(actionType !== "all"
        ? { actionType: actionType as PlatformModerationActionType }
        : {}),
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

    const actions = await db.platformModerationAction.findMany({
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
        warning: {
          select: {
            id: true,
            reason: true,
            notes: true,
            status: true,
            removedAt: true,
            promotedToStrikeId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        strike: {
          select: {
            id: true,
            severity: true,
            reason: true,
            sourceType: true,
            autoBanTriggered: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const hasMore = actions.length > limit;
    const items = hasMore ? actions.slice(0, limit) : actions;
    const lastItem = items.length > 0 ? items[items.length - 1] : null;
    const nextCursor =
      hasMore && lastItem
        ? buildDateCursor({
            createdAt: lastItem.createdAt,
            id: lastItem.id,
          })
        : null;

    const serializedItems = items.map((action) => ({
      ...action,
      profile: serializeModerationProfile(action.profile),
      issuedBy: serializeModerationProfile(action.issuedBy),
      createdAt: action.createdAt.toISOString(),
      report: action.report
        ? {
            ...action.report,
            createdAt: action.report.createdAt.toISOString(),
          }
        : null,
      warning: action.warning
        ? {
            ...action.warning,
            createdAt: action.warning.createdAt.toISOString(),
            updatedAt: action.warning.updatedAt.toISOString(),
            removedAt: action.warning.removedAt?.toISOString() ?? null,
          }
        : null,
      strike: action.strike
        ? {
            ...action.strike,
            createdAt: action.strike.createdAt.toISOString(),
          }
        : null,
    }));

    return NextResponse.json({
      items: serializedItems,
      actions: serializedItems,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CURSOR") {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }

    console.error("[MODERATION_ACTIONS]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
