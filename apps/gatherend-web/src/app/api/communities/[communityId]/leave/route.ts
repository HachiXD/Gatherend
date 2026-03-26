import { CommunityRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handleLeaveCommunity(
  _req: Request,
  context: { params: Promise<{ communityId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
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

    await db.$transaction(async (tx) => {
      const community = await tx.community.findUnique({
        where: { id: communityId },
        select: {
          id: true,
          createdById: true,
        },
      });

      if (!community) {
        throw new Error("COMMUNITY_NOT_FOUND");
      }

      const membership = await tx.communityMember.findUnique({
        where: {
          communityId_profileId: {
            communityId,
            profileId: profile.id,
          },
        },
        select: {
          id: true,
          role: true,
        },
      });

      if (!membership) {
        throw new Error("NOT_A_MEMBER");
      }

      if (
        community.createdById === profile.id ||
        membership.role === CommunityRole.OWNER
      ) {
        throw new Error("OWNER_CANNOT_LEAVE");
      }

      const helperMembership = await tx.communityHelper.findFirst({
        where: {
          communityId,
          profileId: profile.id,
        },
        select: {
          id: true,
        },
      });

      if (helperMembership) {
        throw new Error("HELPER_CANNOT_LEAVE");
      }

      await tx.communityMember.delete({
        where: {
          communityId_profileId: {
            communityId,
            profileId: profile.id,
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "COMMUNITY_NOT_FOUND") {
        return NextResponse.json(
          { error: "Community not found" },
          { status: 404 },
        );
      }
      if (error.message === "NOT_A_MEMBER") {
        return NextResponse.json({ error: "Not a member" }, { status: 403 });
      }
      if (error.message === "OWNER_CANNOT_LEAVE") {
        return NextResponse.json(
          { error: "The owner cannot leave the community" },
          { status: 403 },
        );
      }
      if (error.message === "HELPER_CANNOT_LEAVE") {
        return NextResponse.json(
          { error: "Community helpers cannot leave without being removed first" },
          { status: 403 },
        );
      }
    }

    console.error("[LEAVE_COMMUNITY]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ communityId: string }> },
) {
  return handleLeaveCommunity(req, context);
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ communityId: string }> },
) {
  return handleLeaveCommunity(req, context);
}
