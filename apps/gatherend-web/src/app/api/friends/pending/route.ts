import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import {
  serializeProfileSummary,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";

// Cache control for GET
export const dynamic = "force-dynamic";

const friendshipProfileSelect = {
  id: true,
  username: true,
  discriminator: true,
  usernameColor: true,
  profileTags: true,
  badge: true,
  usernameFormat: true,
  avatarAsset: {
    select: uploadedAssetSummarySelect,
  },
  badgeSticker: {
    select: {
      id: true,
      asset: {
        select: uploadedAssetSummarySelect,
      },
    },
  },
} as const;

export async function GET() {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    // Obtain pending friend requests where the current user is the receiver
    const pendingRequests = await db.friendship.findMany({
      where: {
        receiverId: profile.id,
        status: "PENDING",
      },
      include: {
        requester: {
          select: friendshipProfileSelect,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Format the response to include the full username with discriminator
    // Filter requests where the requester does not exist (deleted or inconsistent)
    const formattedRequests = pendingRequests
      .filter((request) => request.requester !== null)
      .map((request) => ({
        ...request,
        requester: {
          ...serializeProfileSummary(request.requester!),
          fullUsername: `${request.requester!.username}/${request.requester!.discriminator}`,
        },
      }));

    return NextResponse.json(formattedRequests);
  } catch (error) {
    console.error("[FRIENDS_PENDING_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
