import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { Prisma } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  buildReportQueueCursor,
  getSafeCursorLimit,
  parseReportQueueCursor,
} from "@/lib/platform-moderation";
import {
  moderationProfileSelect,
  moderationProfileWithUserIdSelect,
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
    const cursor = parseReportQueueCursor(searchParams.get("cursor"));
    const limit = getSafeCursorLimit(searchParams.get("limit"));

    const cursorFilter =
      cursor !== null
        ? Prisma.sql`
            AND (
              CASE r.priority
                WHEN 'urgent' THEN 0
                WHEN 'high' THEN 1
                WHEN 'medium' THEN 2
                WHEN 'low' THEN 3
                ELSE 999
              END > ${cursor.priorityWeight}
              OR (
                CASE r.priority
                  WHEN 'urgent' THEN 0
                  WHEN 'high' THEN 1
                  WHEN 'medium' THEN 2
                  WHEN 'low' THEN 3
                  ELSE 999
                END = ${cursor.priorityWeight}
                AND (
                  r."createdAt" < ${cursor.createdAt}
                  OR (r."createdAt" = ${cursor.createdAt} AND r.id < ${cursor.id})
                )
              )
            )
          `
        : Prisma.empty;

    const reportRows = await db.$queryRaw<
      Array<{
        id: string;
        createdAt: Date;
        priority: string;
        priorityWeight: number;
      }>
    >(Prisma.sql`
      SELECT
        r.id,
        r."createdAt",
        r.priority,
        CASE r.priority
          WHEN 'urgent' THEN 0
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
          ELSE 999
        END AS "priorityWeight"
      FROM "Report" r
      WHERE r.status IN ('PENDING', 'REVIEWING')
      ${cursorFilter}
      ORDER BY
        CASE r.priority
          WHEN 'urgent' THEN 0
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
          ELSE 999
        END ASC,
        r."createdAt" DESC,
        r.id DESC
      LIMIT ${limit + 1}
    `);

    const hasMore = reportRows.length > limit;
    const pageRows = hasMore ? reportRows.slice(0, limit) : reportRows;
    const reportIds = pageRows.map((row) => row.id);

    const reports =
      reportIds.length === 0
        ? []
        : await db.report.findMany({
            where: { id: { in: reportIds } },
            include: {
              reporter: {
                select: moderationProfileSelect,
              },
              targetOwner: {
                select: moderationProfileWithUserIdSelect,
              },
            },
          });

    const reportById = new Map(reports.map((report) => [report.id, report]));

    const transformedReports = pageRows.reduce<
      Array<{
        id: string;
        targetType: string;
        targetId: string;
        boardId: string | null;
        channelId: string | null;
        category: string;
        status: string;
        priority: string;
        description: string | null;
        createdAt: string;
        reporter: ReturnType<typeof serializeModerationProfile>;
        targetOwner: ReturnType<typeof serializeModerationProfile>;
        snapshot: Record<string, unknown>;
      }>
    >((acc, row) => {
      const report = reportById.get(row.id);

      if (!report) {
        return acc;
      }

      acc.push({
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
        reporter: serializeModerationProfile(report.reporter),
        targetOwner: serializeModerationProfile(report.targetOwner),
        snapshot: report.snapshot as Record<string, unknown>,
      });

      return acc;
    }, []);

    const lastRow = pageRows.length > 0 ? pageRows[pageRows.length - 1] : null;
    const nextCursor =
      hasMore && lastRow
        ? buildReportQueueCursor({
            priorityWeight: lastRow.priorityWeight,
            createdAt: lastRow.createdAt,
            id: lastRow.id,
          })
        : null;

    return NextResponse.json({
      items: transformedReports,
      reports: transformedReports,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CURSOR") {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }

    console.error("[MODERATION_REPORTS_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
