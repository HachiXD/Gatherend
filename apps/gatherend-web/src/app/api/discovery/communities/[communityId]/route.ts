import { db } from "@/lib/db";
import { NextResponse } from "next/server";
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

const MAX_ACTIVE_BOARD_AGE_MS = 48 * 60 * 60 * 1000;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ communityId: string }> },
) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const { communityId } = await params;

    // Validate UUID
    if (!communityId || !UUID_REGEX.test(communityId)) {
      return NextResponse.json(
        { error: "Invalid community ID" },
        { status: 400 },
      );
    }

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const { profile } = auth;

    const activeBoardWindowStart = new Date(
      Date.now() - MAX_ACTIVE_BOARD_AGE_MS,
    );

    const [community, postCount] = await Promise.all([
      db.community.findUnique({
        where: { id: communityId },
        select: {
          id: true,
          name: true,
          createdById: true,
          memberCount: true,
          helpers: {
            where: {
              profileId: profile.id,
            },
            select: {
              id: true,
            },
          },
          boards: {
            where: {
              OR: [
                { createdAt: { gte: activeBoardWindowStart } },
                { refreshedAt: { gte: activeBoardWindowStart } },
              ],
              slots: {
                some: {
                  mode: "BY_DISCOVERY",
                  memberId: null,
                },
              },
            },
            select: { id: true },
          },
          imageAsset: {
            select: uploadedAssetSummarySelect,
          },
        },
      }),
      db.communityPost.count({
        where: {
          communityId,
          deleted: false,
        },
      }),
    ]);

    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: community.id,
      name: community.name,
      imageAsset: serializeUploadedAsset(community.imageAsset),
      memberCount: community.memberCount,
      activeBoardsCount: community.boards.length,
      postCount,
      canDeleteAnyPost:
        community.createdById === profile.id || community.helpers.length > 0,
    });
  } catch (error) {
    console.error("[DISCOVERY_COMMUNITY_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
