import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import {
  UUID_REGEX,
  serializeUploadedAsset,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(
  _req: Request,
  context: { params: Promise<{ boardId: string; channelId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const { boardId, channelId } = await context.params;

    if (
      !boardId ||
      !UUID_REGEX.test(boardId) ||
      !channelId ||
      !UUID_REGEX.test(channelId)
    ) {
      return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
    }

    const [boardMember, channelMember] = await Promise.all([
      db.member.findFirst({
        where: {
          boardId,
          profileId: profile.id,
        },
        select: { id: true },
      }),
      db.channelMember.findUnique({
        where: {
          channelId_profileId: {
            channelId,
            profileId: profile.id,
          },
        },
        select: {
          id: true,
          channel: {
            select: {
              boardId: true,
            },
          },
        },
      }),
    ]);

    if (!boardMember) {
      return NextResponse.json(
        { error: "Not a board member" },
        { status: 403 },
      );
    }

    if (!channelMember || channelMember.channel.boardId !== boardId) {
      return NextResponse.json(
        { error: "Not a channel member" },
        { status: 403 },
      );
    }

    const mentionableMembers = await db.channelMember.findMany({
      where: {
        channelId,
        profileId: {
          not: profile.id,
        },
      },
      orderBy: [
        {
          profile: {
            username: "asc",
          },
        },
        {
          profile: {
            discriminator: "asc",
          },
        },
      ],
      select: {
        profileId: true,
        profile: {
          select: {
            id: true,
            username: true,
            discriminator: true,
            avatarAsset: {
              select: uploadedAssetSummarySelect,
            },
          },
        },
      },
    });

    return NextResponse.json(
      mentionableMembers.map((member) => ({
        profileId: member.profileId,
        profile: {
          ...member.profile,
          avatarAsset: serializeUploadedAsset(member.profile.avatarAsset),
        },
      })),
    );
  } catch (error) {
    console.error("[MENTIONABLE_MEMBERS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
