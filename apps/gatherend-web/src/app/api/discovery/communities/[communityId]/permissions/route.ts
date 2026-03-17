import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ communityId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const { profile } = auth;

    const { communityId } = await params;

    if (!communityId || !UUID_REGEX.test(communityId)) {
      return NextResponse.json(
        { error: "Invalid community ID" },
        { status: 400 },
      );
    }

    const community = await db.community.findUnique({
      where: { id: communityId },
      select: {
        id: true,
        createdById: true,
        helpers: {
          where: {
            profileId: profile.id,
          },
          select: {
            id: true,
          },
        },
      },
    });

    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 },
      );
    }

    const isOwner = community.createdById === profile.id;
    const hasHelperAccess = community.helpers.length > 0;

    return NextResponse.json({
      communityId: community.id,
      isOwner,
      isHelper: !isOwner && hasHelperAccess,
      canManageCommunityContent: isOwner || hasHelperAccess,
    });
  } catch (error) {
    console.error("[DISCOVERY_COMMUNITY_PERMISSIONS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
