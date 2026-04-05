import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  moderationProfileSelect,
  serializeModerationProfile,
} from "@/lib/moderation-serialization";
import { serializeUploadedAsset, uploadedAssetSummarySelect } from "@/lib/uploaded-assets";

export const dynamic = "force-dynamic";

export async function GET() {
  const rateLimitResponse = await checkRateLimit(RATE_LIMITS.moderationRead);
  if (rateLimitResponse) return rateLimitResponse;

  const admin = await requireAdmin();
  if (!admin.success) return admin.response;

  try {
    const investigations = await db.boardInvestigation.findMany({
      where: {
        status: "OPEN",
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        board: {
          select: {
            id: true,
            name: true,
            description: true,
            isPrivate: true,
            inviteEnabled: true,
            reportCount: true,
            memberCount: true,
            riskPoints: true,
            riskLevel: true,
            createdAt: true,
            imageAsset: {
              select: uploadedAssetSummarySelect,
            },
            profile: {
              select: moderationProfileSelect,
            },
          },
        },
        openedBy: {
          select: moderationProfileSelect,
        },
        sourceReport: {
          select: {
            id: true,
            targetType: true,
            category: true,
            priority: true,
            status: true,
            createdAt: true,
            boardId: true,
          },
        },
      },
    });

    return NextResponse.json({
      items: investigations.map((investigation) => ({
        id: investigation.id,
        boardId: investigation.boardId,
        status: investigation.status,
        notes: investigation.notes,
        boardSnapshot: investigation.boardSnapshot,
        createdAt: investigation.createdAt.toISOString(),
        updatedAt: investigation.updatedAt.toISOString(),
        openedBy: serializeModerationProfile(investigation.openedBy),
        sourceReport: {
          ...investigation.sourceReport,
          createdAt: investigation.sourceReport.createdAt.toISOString(),
        },
        board: investigation.board
          ? {
              id: investigation.board.id,
              name: investigation.board.name,
              description: investigation.board.description,
              isPrivate: investigation.board.isPrivate,
              inviteEnabled: investigation.board.inviteEnabled,
              reportCount: investigation.board.reportCount,
              memberCount: investigation.board.memberCount,
              riskPoints: investigation.board.riskPoints,
              riskLevel: investigation.board.riskLevel,
              createdAt: investigation.board.createdAt.toISOString(),
              imageAsset: serializeUploadedAsset(investigation.board.imageAsset),
              owner: serializeModerationProfile(investigation.board.profile),
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("[MODERATION_BOARD_INVESTIGATIONS_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
