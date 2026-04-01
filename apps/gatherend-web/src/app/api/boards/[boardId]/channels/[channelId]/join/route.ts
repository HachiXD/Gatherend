import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { serializeProfileSummary } from "@/lib/uploaded-assets";
import {
  reserveChannelMessageSeqRange,
  upsertChannelReadState,
} from "@/lib/channels/read-state";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function notifyWelcomeMessage(channelId: string, message: object) {
  try {
    const socketUrl =
      process.env.SOCKET_SERVER_URL || process.env.NEXT_PUBLIC_SOCKET_URL;
    const secret = process.env.INTERNAL_API_SECRET;
    if (!socketUrl || !secret) return;
    await fetch(`${socketUrl}/emit-to-room`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": secret,
      },
      body: JSON.stringify({
        room: `channel:${channelId}`,
        event: `chat:${channelId}:messages`,
        data: message,
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (error) {
    console.error("[NOTIFY_WELCOME_MESSAGE]", error);
  }
}

async function notifyChannelMembershipChanged(
  boardId: string,
  channelId: string,
  profileId: string,
  channelMemberCount: number,
) {
  try {
    const socketUrl =
      process.env.SOCKET_SERVER_URL || process.env.NEXT_PUBLIC_SOCKET_URL;
    const secret = process.env.INTERNAL_API_SECRET;
    if (!socketUrl || !secret) return;
    await fetch(`${socketUrl}/emit-to-room`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": secret,
      },
      body: JSON.stringify({
        room: `board:${boardId}`,
        event: "board:channel-membership-changed",
        data: {
          boardId,
          channelId,
          profileId,
          action: "joined",
          channelMemberCount,
          timestamp: Date.now(),
        },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (error) {
    console.error("[NOTIFY_CHANNEL_MEMBERSHIP_CHANGED]", error);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeWelcomeMessagePayload(message: any) {
  return {
    ...message,
    messageSender: message.messageSender
      ? serializeProfileSummary(message.messageSender)
      : null,
    member: message.member
      ? {
          ...message.member,
          profile: serializeProfileSummary(
            message.member.profile ?? message.messageSender ?? null,
          ),
        }
      : null,
  };
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ boardId: string; channelId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.channelJoin);
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

    const member = await db.member.findFirst({
      where: { boardId, profileId: profile.id },
      select: { id: true },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Not a board member" },
        { status: 403 },
      );
    }

    const channel = await db.channel.findFirst({
      where: { id: channelId, boardId },
      select: { id: true },
    });

    if (!channel) {
      return NextResponse.json(
        { error: "Channel not found" },
        { status: 404 },
      );
    }

    const result = await db.$transaction(async (tx) => {
      await tx.channelMember.create({
        data: { channelId, profileId: profile.id },
      });

      const seq = await reserveChannelMessageSeqRange(tx, channelId, 1);

      const message = await tx.message.create({
        data: {
          channelId,
          seq,
          type: "WELCOME",
          content: "",
          memberId: member.id,
          messageSenderId: profile.id,
        },
        include: {
          member: {
            include: {
              profile: {
                include: {
                  avatarAsset: true,
                  badgeSticker: { include: { asset: true } },
                },
              },
            },
          },
          messageSender: {
            include: {
              avatarAsset: true,
              badgeSticker: { include: { asset: true } },
            },
          },
        },
      });

      await upsertChannelReadState(tx, {
        profileId: profile.id,
        channelId,
        lastReadSeq: seq,
      });

      const hydratedChannel = await tx.channel.findUniqueOrThrow({
        where: { id: channelId },
        select: {
          _count: {
            select: {
              channelMembers: true,
            },
          },
        },
      });

      return {
        message,
        channelMemberCount: hydratedChannel._count.channelMembers,
      };
    });

    void notifyWelcomeMessage(
      channelId,
      serializeWelcomeMessagePayload(result.message),
    );
    void notifyChannelMembershipChanged(
      boardId,
      channelId,
      profile.id,
      result.channelMemberCount,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ success: true, alreadyJoined: true });
    }

    console.error("[CHANNEL_JOIN]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
