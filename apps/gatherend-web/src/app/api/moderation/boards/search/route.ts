import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  moderationProfileSelect,
  serializeModerationProfile,
} from "@/lib/moderation-serialization";
import { serializeUploadedAsset, UUID_REGEX, uploadedAssetSummarySelect } from "@/lib/uploaded-assets";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rateLimitResponse = await checkRateLimit(RATE_LIMITS.moderationRead);
  if (rateLimitResponse) return rateLimitResponse;

  const admin = await requireAdmin();
  if (!admin.success) return admin.response;

  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim() ?? "";

    if (!query) {
      return NextResponse.json({ items: [] });
    }

    const normalizedQuery = query.slice(0, 100);
    const isExactUuid = UUID_REGEX.test(normalizedQuery);

    const boards = await db.board.findMany({
      where: {
        OR: [
          ...(isExactUuid ? [{ id: normalizedQuery }] : []),
          {
            name: {
              contains: normalizedQuery,
              mode: "insensitive",
            },
          },
        ],
      },
      take: 20,
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        description: true,
        isPrivate: true,
        inviteEnabled: true,
        hiddenFromFeed: true,
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
    });

    const items = boards.map((board) => ({
      id: board.id,
      name: board.name,
      description: board.description,
      isPrivate: board.isPrivate,
      inviteEnabled: board.inviteEnabled,
      hiddenFromFeed: board.hiddenFromFeed,
      reportCount: board.reportCount,
      memberCount: board.memberCount,
      riskPoints: board.riskPoints,
      riskLevel: board.riskLevel,
      createdAt: board.createdAt.toISOString(),
      imageAsset: serializeUploadedAsset(board.imageAsset),
      owner: serializeModerationProfile(board.profile),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[MODERATION_BOARD_SEARCH_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
