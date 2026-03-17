/**
 * Cron endpoint to update community rankings
 *
 * Called every 1 minute by external cron service (Railway cron, Vercel cron, etc.)
 *
 * This updates:
 * - memberCount: Total unique members across all boards
 * - feedBoardCount: Boards currently in discovery feed (within 48h window + has vacant slots)
 * - rankingScore: LOG(memberCount + 1) + feedBoardCount * 0.5
 * - recentPostCount7d: Non-deleted posts created in the last 7 days
 * - rankedAt: Timestamp of last update
 *
 * After update, invalidates Redis cache so fresh data is served.
 *
 * SECURITY:
 * - Requires CRON_SECRET environment variable
 * - Must be called with Authorization: Bearer <CRON_SECRET>
 * - In production, CRON_SECRET must be set or endpoint returns 500
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { communityFeedCache } from "@/lib/redis";
import { logger } from "@/lib/logger";

// No cachear requests
export const dynamic = "force-dynamic";

// Verify cron secret to prevent unauthorized calls
const CRON_SECRET = process.env.CRON_SECRET;

// Must match the value in /api/discovery/communities/[communityId]/boards
const MAX_AGE_HOURS = 48.0;

// Max execution time before we log a warning (in ms)
const SLOW_QUERY_THRESHOLD_MS = 5000;

export async function POST(req: Request) {
  try {
    // SECURITY: In production, CRON_SECRET must be defined
    if (!CRON_SECRET) {
      // In development, allow unauthenticated calls but log a warning
      if (process.env.NODE_ENV === "production") {
        console.error("[CRON] CRON_SECRET not configured in production!");
        return NextResponse.json(
          { success: false, error: "Server misconfiguration" },
          { status: 500 },
        );
      }
      logger.warn(
        "[CRON] CRON_SECRET not set - allowing unauthenticated access in development",
      );
    } else {
      // Verify authorization
      const authHeader = req.headers.get("authorization");
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 },
        );
      }
    }

    const startTime = Date.now();

    // Window start for feed visibility (same as boards endpoint)
    const windowStart = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000);
    const postsWindowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Update all community rankings in a single query
    const result = await db.$executeRaw`
      WITH community_stats AS (
        SELECT 
          c.id,
          -- Count unique members across all boards in community
          COALESCE((
            SELECT COUNT(DISTINCT m."profileId")
            FROM "Board" b
            JOIN "Member" m ON m."boardId" = b.id
            WHERE b."communityId" = c.id
          ), 0)::INTEGER as member_count,
          -- Count boards currently in discovery feed:
          -- 1. Within 48h window (createdAt or refreshedAt)
          -- 2. Has at least one vacant discovery slot
          COALESCE((
            SELECT COUNT(DISTINCT b.id)
            FROM "Board" b
            WHERE b."communityId" = c.id
              AND (b."createdAt" >= ${windowStart} OR b."refreshedAt" >= ${windowStart})
              AND EXISTS (
                SELECT 1 FROM "Slot" s
                WHERE s."boardId" = b.id
                  AND s.mode = 'BY_DISCOVERY'
                  AND s."memberId" IS NULL
                )
          ), 0)::INTEGER as feed_board_count,
          COALESCE((
            SELECT COUNT(*)
            FROM "CommunityPost" p
            WHERE p."communityId" = c.id
              AND p.deleted = false
              AND p."createdAt" >= ${postsWindowStart}
          ), 0)::INTEGER as recent_post_count_7d
        FROM "Community" c
      )
      UPDATE "Community" c
      SET 
        "memberCount" = cs.member_count,
        "feedBoardCount" = cs.feed_board_count,
        "recentPostCount7d" = cs.recent_post_count_7d,
        "rankingScore" = LN(cs.member_count + 1) + cs.feed_board_count * 0.5,
        "rankedAt" = CURRENT_TIMESTAMP
      FROM community_stats cs
      WHERE c.id = cs.id
    `;

    // Invalidate Redis cache
    await communityFeedCache.invalidateAll();

    const duration = Date.now() - startTime;

    // Telemetry: Warn if query is slow
    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      logger.warn(
        `[CRON] Slow ranking update: ${duration}ms (threshold: ${SLOW_QUERY_THRESHOLD_MS}ms)`,
      );
    }

    return NextResponse.json({
      success: true,
      updated: Number(result),
      durationMs: duration,
    });
  } catch (error) {
    console.error("[CRON] Error updating community rankings:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// GET method for health checks only (returns info without running update)
export async function GET(req: Request) {
  // For health checks, just verify the endpoint is reachable
  // Actual updates should use POST
  const authHeader = req.headers.get("authorization");
  const isAuthorized = !CRON_SECRET || authHeader === `Bearer ${CRON_SECRET}`;

  if (!isAuthorized) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  // In development, allow GET to trigger update for testing
  if (process.env.NODE_ENV !== "production") {
    return POST(req);
  }

  // In production, GET only returns status
  return NextResponse.json({
    success: true,
    message: "Cron endpoint healthy. Use POST to trigger update.",
    maxAgeHours: MAX_AGE_HOURS,
  });
}
