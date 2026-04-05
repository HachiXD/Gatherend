import type { Prisma } from "@prisma/client";
import { ReportStatus, ReportTargetType } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { loadBoardDeletionSnapshot, serializeBoardDeletionSnapshot } from "@/lib/board-deletion";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
  if (rateLimitResponse) return rateLimitResponse;

  const admin = await requireAdmin();
  if (!admin.success) return admin.response;

  try {
    const { reportId } = await params;

    if (!reportId || typeof reportId !== "string" || reportId.length > 191) {
      return NextResponse.json({ error: "Invalid report ID" }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      const report = await tx.report.findUnique({
        where: { id: reportId },
        select: {
          id: true,
          boardId: true,
          targetType: true,
          status: true,
        },
      });

      if (!report) {
        throw new Error("NOT_FOUND");
      }

      if (!report.boardId) {
        throw new Error("BOARD_REQUIRED");
      }

      if (report.targetType === ReportTargetType.BOARD) {
        throw new Error("BOARD_REPORT_NOT_ELIGIBLE");
      }

      const existing = await tx.boardInvestigation.findFirst({
        where: {
          boardId: report.boardId,
          status: "OPEN",
        },
        select: {
          id: true,
          sourceReportId: true,
        },
      });

      if (report.status === ReportStatus.PENDING) {
        await tx.report.update({
          where: { id: report.id },
          data: {
            status: ReportStatus.REVIEWING,
          },
        });
      }

      if (existing) {
        return {
          investigationId: existing.id,
          existing: true,
        };
      }

      const board = await loadBoardDeletionSnapshot(tx, report.boardId);

      if (!board) {
        throw new Error("BOARD_NOT_FOUND");
      }

      const created = await tx.boardInvestigation.create({
        data: {
          boardId: report.boardId,
          sourceReportId: report.id,
          openedById: admin.profile.id,
          status: "OPEN",
          boardSnapshot: serializeBoardDeletionSnapshot(
            board,
          ) as Prisma.InputJsonValue,
        },
        select: {
          id: true,
        },
      });

      return {
        investigationId: created.id,
        existing: false,
      };
    });

    return NextResponse.json({
      success: true,
      investigationId: result.investigationId,
      existing: result.existing,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
      }

      if (error.message === "BOARD_NOT_FOUND") {
        return NextResponse.json({ error: "Board not found" }, { status: 404 });
      }

      if (error.message === "BOARD_REQUIRED") {
        return NextResponse.json(
          { error: "This report is not linked to a board" },
          { status: 400 },
        );
      }

      if (error.message === "BOARD_REPORT_NOT_ELIGIBLE") {
        return NextResponse.json(
          { error: "Board metadata reports cannot open investigations" },
          { status: 400 },
        );
      }
    }

    console.error("[MODERATION_REPORT_INVESTIGATION_POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
