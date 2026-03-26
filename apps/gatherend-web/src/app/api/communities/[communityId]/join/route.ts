import { CommunityRole, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _req: Request,
  context: { params: Promise<{ communityId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.boardJoin);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const params = await context.params;
    const communityId = params.communityId;

    if (!communityId || !UUID_REGEX.test(communityId)) {
      return NextResponse.json(
        { error: "Invalid community ID" },
        { status: 400 },
      );
    }

    const community = await db.community.findUnique({
      where: { id: communityId },
      select: { id: true },
    });

    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 },
      );
    }

    const existingMembership = await db.communityMember.findUnique({
      where: {
        communityId_profileId: {
          communityId,
          profileId: profile.id,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingMembership) {
      return NextResponse.json({
        alreadyMember: true,
        membershipId: existingMembership.id,
      });
    }

    const membership = await db.communityMember.create({
      data: {
        communityId,
        profileId: profile.id,
        role: CommunityRole.MEMBER,
      },
      select: {
        id: true,
      },
    });

    return NextResponse.json({
      success: true,
      membershipId: membership.id,
    });
  } catch (error) {
    console.error("[COMMUNITY_JOIN] Error:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        { error: "Already a member of this community" },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
