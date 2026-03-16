import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { FriendshipStatus } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import {
  serializeProfileSummary,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

const conversationProfileSelect = {
  ...friendshipProfileSelect,
  userId: true,
} as const;

export async function PATCH(
  req: Request,
  context: { params: Promise<{ friendshipId: string }> },
) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const params = await context.params;
    const { friendshipId } = params;

    // Validate UUID
    if (!UUID_REGEX.test(friendshipId)) {
      return NextResponse.json(
        { error: "Invalid friendship ID" },
        { status: 400 },
      );
    }

    // Parse body with error handling
    let action: unknown;
    try {
      const body = await req.json();
      action = body.action;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (
      !action ||
      typeof action !== "string" ||
      !["accept", "reject"].includes(action)
    ) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Auth check
    const auth = await requireAuth();
    if (!auth.success) return auth.response;

    // auth.profile is guaranteed to be ProfileData here
    const profile = auth.profile;

    // Update status
    const newStatus: FriendshipStatus =
      action === "accept" ? "ACCEPTED" : "REJECTED";

    // Execute everything in a transaction to avoid race conditions
    const result = await db.$transaction(async (tx) => {
      const friendship = await tx.friendship.findUnique({
        where: { id: friendshipId },
        select: {
          id: true,
          status: true,
          requesterId: true,
          receiverId: true,
        },
      });

      if (!friendship) {
        throw new Error("NOT_FOUND");
      }

      if (friendship.receiverId !== profile.id) {
        throw new Error("FORBIDDEN");
      }

      if (friendship.status !== "PENDING") {
        throw new Error("NOT_PENDING");
      }

      const updatedFriendship = await tx.friendship.update({
        where: { id: friendshipId },
        data: { status: newStatus },
        include: {
          requester: {
            select: friendshipProfileSelect,
          },
          receiver: {
            select: friendshipProfileSelect,
          },
        },
      });

      let newConversation = null;

      // If the friendship is accepted, create a conversation automatically
      if (action === "accept") {
        const existingConversation = await tx.conversation.findFirst({
          where: {
            OR: [
              {
                profileOneId: friendship.requesterId,
                profileTwoId: friendship.receiverId,
              },
              {
                profileOneId: friendship.receiverId,
                profileTwoId: friendship.requesterId,
              },
            ],
          },
        });

        if (!existingConversation) {
          newConversation = await tx.conversation.create({
            data: {
              profileOneId: friendship.requesterId,
              profileTwoId: friendship.receiverId,
            },
            include: {
              profileOne: {
                select: conversationProfileSelect,
              },
              profileTwo: {
                select: conversationProfileSelect,
              },
            },
          });
        }
      }

      return {
        updatedFriendship,
        newConversation,
        requesterId: friendship.requesterId,
        receiverId: friendship.receiverId,
      };
    });

    // Emit socket events outside the transaction
    if (result.newConversation) {
      const socketUrl = process.env.SOCKET_SERVER_URL;
      if (socketUrl) {
        const serializedConversation = {
          ...result.newConversation,
          profileOne: serializeProfileSummary(result.newConversation.profileOne!),
          profileTwo: serializeProfileSummary(result.newConversation.profileTwo!),
        };

        // Notify the requester
        fetch(`${socketUrl}/emit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Secret": process.env.INTERNAL_API_SECRET || "",
          },
          body: JSON.stringify({
            channelKey: `user:${result.requesterId}:new-conversation`,
            data: {
              conversation: serializedConversation,
              otherProfile: serializedConversation.profileTwo,
            },
          }),
          signal: AbortSignal.timeout(3000),
        }).catch((err) => console.error("Error emitting to requester:", err));

        // Notify the receiver
        fetch(`${socketUrl}/emit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Secret": process.env.INTERNAL_API_SECRET || "",
          },
          body: JSON.stringify({
            channelKey: `user:${result.receiverId}:new-conversation`,
            data: {
              conversation: serializedConversation,
              otherProfile: serializedConversation.profileOne,
            },
          }),
          signal: AbortSignal.timeout(3000),
        }).catch((err) => console.error("Error emitting to receiver:", err));
      }
    }

    return NextResponse.json({
      ...result.updatedFriendship,
      requester: serializeProfileSummary(result.updatedFriendship.requester),
      receiver: serializeProfileSummary(result.updatedFriendship.receiver),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND")
        return NextResponse.json(
          { error: "Friendship not found" },
          { status: 404 },
        );
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (error.message === "NOT_PENDING")
        return NextResponse.json(
          { error: "Friendship is not pending" },
          { status: 400 },
        );
    }
    console.error("[FRIENDSHIP_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
