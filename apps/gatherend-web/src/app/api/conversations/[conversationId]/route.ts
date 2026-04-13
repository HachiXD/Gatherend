import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import {
  serializePublicAsset,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";
import { normalizeChatBubbleStyle } from "@/lib/chat-bubble-style";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  chatBubbleStyle: true,
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
  chatBubbleStyle: unknown;
  avatarAsset: Parameters<typeof serializePublicAsset>[0];
} | null) {
  if (!profile) {
    return null;
  }

  return {
    ...profile,
    chatBubbleStyle: normalizeChatBubbleStyle(profile.chatBubbleStyle),
    avatarAsset: serializePublicAsset(profile.avatarAsset),
  };
}

export async function GET(
  req: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const { conversationId } = await context.params;

    if (!conversationId || !UUID_REGEX.test(conversationId)) {
      return NextResponse.json(
        { error: "Invalid conversation ID" },
        { status: 400 },
      );
    }

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const conversation = await db.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ profileOneId: profile.id }, { profileTwoId: profile.id }],
      },
      select: {
        id: true,
        profileOneId: true,
        profileTwoId: true,
        createdAt: true,
        updatedAt: true,
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
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    const profileOne = serializeConversationProfile(conversation.profileOne);
    const profileTwo = serializeConversationProfile(conversation.profileTwo);

    if (!profileOne || !profileTwo) {
      return NextResponse.json(
        { error: "Conversation data is incomplete" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ...conversation,
      profileOne,
      profileTwo,
    });
  } catch (error) {
    console.error("[CONVERSATION_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
