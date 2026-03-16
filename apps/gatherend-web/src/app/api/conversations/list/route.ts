import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import {
  serializePublicAsset,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const conversationProfileSelect = {
  id: true,
  username: true,
  discriminator: true,
  email: true,
  userId: true,
  usernameColor: true,
  usernameFormat: true,
  avatarAsset: {
    select: uploadedAssetSummarySelect,
  },
} as const;

function serializeConversationProfile(profile: {
  id: string;
  username: string;
  discriminator: string | null;
  email: string;
  userId: string;
  usernameColor: unknown;
  usernameFormat: unknown;
  avatarAsset: Parameters<typeof serializePublicAsset>[0];
} | null) {
  if (!profile) {
    return null;
  }

  return {
    ...profile,
    avatarAsset: serializePublicAsset(profile.avatarAsset),
  };
}

export async function GET() {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const conversations = await db.conversation.findMany({
      where: {
        OR: [
          {
            profileOneId: profile.id,
            hiddenByOneAt: null,
          },
          {
            profileTwoId: profile.id,
            hiddenByTwoAt: null,
          },
        ],
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        profileOneId: true,
        profileTwoId: true,
        hiddenByOneAt: true,
        hiddenByTwoAt: true,
        lastReadByOneAt: true,
        lastReadByTwoAt: true,
        profileOne: {
          select: conversationProfileSelect,
        },
        profileTwo: {
          select: conversationProfileSelect,
        },
        directMessages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            content: true,
            deleted: true,
            senderId: true,
            attachmentAssetId: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    const formattedConversations = conversations.map((conversation) => {
      const profileOne = serializeConversationProfile(conversation.profileOne);
      const profileTwo = serializeConversationProfile(conversation.profileTwo);
      if (!profileOne || !profileTwo) {
        return null;
      }
      const isOne = conversation.profileOneId === profile.id;
      const otherProfile = isOne ? profileTwo : profileOne;
      const lastMessage = conversation.directMessages[0]
        ? {
            content: conversation.directMessages[0].content,
            deleted: conversation.directMessages[0].deleted,
            senderId: conversation.directMessages[0].senderId,
            hasAttachment: Boolean(
              conversation.directMessages[0].attachmentAssetId,
            ),
          }
        : null;

      return {
        ...conversation,
        profileOne,
        profileTwo,
        otherProfile,
        isOne,
        lastMessage,
      };
    }).filter((conversation): conversation is NonNullable<typeof conversation> => Boolean(conversation));

    return NextResponse.json(formattedConversations);
  } catch (error) {
    console.error("[CONVERSATIONS_LIST_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
