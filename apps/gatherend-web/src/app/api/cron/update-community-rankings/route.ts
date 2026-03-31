/**
 * Cron endpoint to update board rankings
 *
 * Called every 1 minute by external cron service (Railway cron, Vercel cron, etc.)
 *
 * This updates:
 * - memberCount: Total members of the board (from Member table)
 * - recentPostCount7d: Non-deleted posts created in the last 7 days
 * - rankingScore: LN(memberCount + 1) + recentPostCount7d * 0.2
 * - rankedAt: Timestamp of last update
 *
 * Only public boards (isPrivate = false) are ranked.
 * After update, invalidates Redis cache so fresh data is served.
 *
 * SECURITY:
 * - Requires CRON_SECRET environment variable
 * - Must be called with Authorization: Bearer <CRON_SECRET>
 * - In production, CRON_SECRET must be set or endpoint returns 500
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { boardFeedCache } from "@/lib/redis";
import { logger } from "@/lib/logger";

// No cachear requests
export const dynamic = "force-dynamic";

// Verify cron secret to prevent unauthorized calls
const CRON_SECRET = process.env.CRON_SECRET;

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

    const postsWindowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Update all public board rankings in a single query
    const result = await db.$executeRaw`
      WITH board_stats AS (
        SELECT
          b.id,
          -- Count board members
          COALESCE((
            SELECT COUNT(*)
            FROM "Member" m
            WHERE m."boardId" = b.id
          ), 0)::INTEGER as member_count,
          -- Count non-deleted posts in the last 7 days
          COALESCE((
            SELECT COUNT(*)
            FROM "CommunityPost" p
            WHERE p."boardId" = b.id
              AND p.deleted = false
              AND p."createdAt" >= ${postsWindowStart}
          ), 0)::INTEGER as recent_post_count_7d
        FROM "Board" b
        WHERE b."isPrivate" = false
      )
      UPDATE "Board" b
      SET
        "memberCount" = bs.member_count,
        "recentPostCount7d" = bs.recent_post_count_7d,
        "rankingScore" = LN(bs.member_count + 1) + bs.recent_post_count_7d * 0.2,
        "rankedAt" = CURRENT_TIMESTAMP
      FROM board_stats bs
      WHERE b.id = bs.id
    `;

    // Invalidate Redis cache
    await boardFeedCache.invalidateAll();

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
  });
}
