import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { MemberRole } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import {
  serializeUploadedAsset,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cacheable - usa datos materializados del cron
export const revalidate = 60; // 1 minuto

export async function GET(
  req: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const { boardId } = await params;

    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json(
        { error: "Invalid board ID" },
        { status: 400 },
      );
    }

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const { profile } = auth;

    const board = await db.board.findUnique({
      where: { id: boardId, isPrivate: false },
      select: {
        id: true,
        name: true,
        profileId: true,
        memberCount: true,
        recentPostCount7d: true,
        imageAsset: {
          select: uploadedAssetSummarySelect,
        },
        bannerAsset: {
          select: uploadedAssetSummarySelect,
        },
        members: {
          where: { profileId: profile.id },
          select: { id: true, role: true },
        },
      },
    });

    if (!board) {
      return NextResponse.json(
        { error: "Board not found" },
        { status: 404 },
      );
    }

    const myMember = board.members[0] ?? null;
    const isOwner = board.profileId === profile.id;
    const isModerator =
      myMember?.role === MemberRole.MODERATOR ||
      myMember?.role === MemberRole.ADMIN;

    return NextResponse.json({
      id: board.id,
      name: board.name,
      imageAsset: serializeUploadedAsset(board.imageAsset),
      bannerAsset: serializeUploadedAsset(board.bannerAsset),
      memberCount: board.memberCount,
      recentPostCount7d: board.recentPostCount7d,
      canDeleteAnyPost: isOwner || isModerator,
      isMember: myMember !== null,
    });
  } catch (error) {
    console.error("[DISCOVERY_BOARD_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
