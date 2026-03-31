import { MemberRole, AssetContext, AssetVisibility } from "@prisma/client";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { moderateDescription } from "@/lib/text-moderation";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  UUID_REGEX,
  findOwnedUploadedAsset,
  serializeUploadedAsset,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";
import {
  expressChannelCache,
  expressMemberCache,
  expressVoiceChannelsCache,
} from "@/lib/redis";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function notifyBoardDeleted(
  boardId: string,
  memberProfileIds: string[],
  deletedByProfileId: string,
) {
  try {
    const socketUrl =
      process.env.SOCKET_SERVER_URL || process.env.NEXT_PUBLIC_SOCKET_URL;
    const secret = process.env.INTERNAL_API_SECRET;

    if (!socketUrl || !secret) return;

    const payload = {
      boardId,
      deletedByProfileId,
      timestamp: Date.now(),
    };

    await Promise.allSettled([
      fetch(`${socketUrl}/emit-to-room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": secret,
        },
        body: JSON.stringify({
          room: `board:${boardId}`,
          event: "board:deleted",
          data: payload,
        }),
        signal: AbortSignal.timeout(3000),
      }),
      ...memberProfileIds.map((profileId) =>
        fetch(`${socketUrl}/emit-to-room`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Secret": secret,
          },
          body: JSON.stringify({
            room: `profile:${profileId}`,
            event: "board:deleted",
            data: payload,
          }),
          signal: AbortSignal.timeout(3000),
        }),
      ),
    ]);
  } catch (error) {
    console.error("[NOTIFY_BOARD_DELETED]", error);
  }
}

export async function GET(
  req: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const params = await context.params;
    const boardId = params.boardId;

    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const board = await db.board.findFirst({
      where: {
        id: boardId,
        members: { some: { profileId: profile.id } },
      },
      include: {
        imageAsset: {
          select: uploadedAssetSummarySelect,
        },
        channels: {
          orderBy: { position: "asc" },
          include: {
            imageAsset: {
              select: uploadedAssetSummarySelect,
            },
            _count: {
              select: { channelMembers: true },
            },
            channelMembers: {
              where: { profileId: profile.id },
              select: { id: true },
              take: 1,
            },
          },
        },
        members: {
          orderBy: { role: "asc" },
          include: {
            profile: {
              select: {
                id: true,
                username: true,
                discriminator: true,
                usernameColor: true,
                profileTags: true,
                badge: true,
                usernameFormat: true,
                longDescription: true,
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
              },
            },
          },
        },
      },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    const serializeProfile = <
      T extends {
        avatarAsset: (typeof board.members)[number]["profile"]["avatarAsset"];
        badgeSticker: (typeof board.members)[number]["profile"]["badgeSticker"];
      },
    >(
      targetProfile: T,
    ) => ({
      ...targetProfile,
      avatarAsset: serializeUploadedAsset(targetProfile.avatarAsset),
      badgeSticker: targetProfile.badgeSticker
        ? {
            id: targetProfile.badgeSticker.id,
            asset: serializeUploadedAsset(targetProfile.badgeSticker.asset),
          }
        : null,
    });

    return NextResponse.json({
      ...board,
      imageAsset: serializeUploadedAsset(board.imageAsset),
      channels: board.channels.map((channel) => ({
        ...channel,
        imageAsset: serializeUploadedAsset(channel.imageAsset),
        channelMemberCount: channel._count.channelMembers,
        isJoined: channel.channelMembers.length > 0,
        _count: undefined,
        channelMembers: undefined,
      })),
      members: board.members.map((member) => ({
        ...member,
        profile: serializeProfile(member.profile),
      })),
    });
  } catch (error) {
    console.error("[BOARD_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const params = await context.params;
    const boardId = params.boardId;

    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      const [member, totalBoardsForProfile] = await Promise.all([
        tx.member.findFirst({
          where: { boardId, profileId: profile.id },
          select: { role: true },
        }),
        tx.member.count({
          where: { profileId: profile.id },
        }),
      ]);

      if (!member) {
        throw new Error("NOT_A_MEMBER");
      }

      if (member.role !== MemberRole.OWNER) {
        throw new Error("FORBIDDEN");
      }

      if (totalBoardsForProfile <= 1) {
        throw new Error("CANNOT_DELETE_LAST_BOARD");
      }

      const boardData = await tx.board.findUnique({
        where: { id: boardId },
        select: {
          members: {
            select: { profileId: true },
          },
          channels: {
            select: { id: true },
          },
        },
      });

      if (!boardData) {
        throw new Error("NOT_FOUND");
      }

      await tx.board.delete({
        where: { id: boardId },
      });

      return {
        memberProfileIds: boardData.members
          .map((member) => member.profileId)
          .filter((profileId): profileId is string => !!profileId),
        channelIds: boardData.channels.map((channel) => channel.id),
      };
    });

    await Promise.all([
      expressMemberCache.invalidateMany(boardId, result.memberProfileIds),
      expressChannelCache.invalidateMany(result.channelIds),
      expressVoiceChannelsCache.invalidate(boardId),
    ]);

    void notifyBoardDeleted(boardId, result.memberProfileIds, profile.id);

    revalidatePath("/boards");

    return NextResponse.json({ success: true, deletedBoardId: boardId });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_A_MEMBER") {
        return NextResponse.json({ error: "Not a member" }, { status: 403 });
      }

      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          { error: "Only the owner can delete the board" },
          { status: 403 },
        );
      }

      if (error.message === "CANNOT_DELETE_LAST_BOARD") {
        return NextResponse.json(
          { error: "You cannot delete your last board" },
          { status: 400 },
        );
      }

      if (error.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Board not found" }, { status: 404 });
      }
    }

    console.error("[BOARD_ID_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const params = await context.params;
    const boardId = params.boardId;

    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    let body: {
      name?: unknown;
      imageAssetId?: unknown;
      description?: unknown;
      isPrivate?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const {
      name,
      imageAssetId,
      description,
      isPrivate,
    } = body;

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length < 2) {
        return NextResponse.json(
          { error: "Board name must be at least 2 characters" },
          { status: 400 },
        );
      }

      if (name.length > 50) {
        return NextResponse.json(
          { error: "Board name cannot exceed 50 characters" },
          { status: 400 },
        );
      }
    }

    if (description !== undefined && description !== null) {
      if (typeof description !== "string") {
        return NextResponse.json(
          { error: "Description must be a string" },
          { status: 400 },
        );
      }

      if (description.length > 300) {
        return NextResponse.json(
          { error: "Description cannot exceed 300 characters" },
          { status: 400 },
        );
      }
    }

    if (isPrivate !== undefined && typeof isPrivate !== "boolean") {
      return NextResponse.json(
        { error: "isPrivate must be a boolean" },
        { status: 400 },
      );
    }

    let resolvedImageAssetId: string | null | undefined = undefined;
    if (imageAssetId !== undefined) {
      if (imageAssetId === null || imageAssetId === "") {
        resolvedImageAssetId = null;
      } else if (
        typeof imageAssetId !== "string" ||
        !UUID_REGEX.test(imageAssetId)
      ) {
        return NextResponse.json(
          { error: "Image asset ID must be a valid UUID" },
          { status: 400 },
        );
      } else {
        const imageAsset = await findOwnedUploadedAsset(
          imageAssetId,
          profile.id,
          AssetContext.BOARD_IMAGE,
          AssetVisibility.PUBLIC,
        );

        if (!imageAsset) {
          return NextResponse.json(
            { error: "Board image asset not found" },
            { status: 400 },
          );
        }

        resolvedImageAssetId = imageAsset.id;
      }
    }

    if (
      description &&
      typeof description === "string" &&
      description.trim().length > 0
    ) {
      const descModeration = moderateDescription(description);
      if (!descModeration.allowed) {
        return NextResponse.json(
          {
            error: "MODERATION_BLOCKED",
            message:
              descModeration.message ||
              "Description contains prohibited content",
            reason: descModeration.reason,
          },
          { status: 400 },
        );
      }
    }

    if (name && typeof name === "string" && name.trim().length > 0) {
      const nameModeration = moderateDescription(name);
      if (!nameModeration.allowed) {
        return NextResponse.json(
          {
            error: "MODERATION_BLOCKED",
            message: "Board name contains prohibited content",
            reason: nameModeration.reason,
          },
          { status: 400 },
        );
      }
    }

    const board = await db.$transaction(async (tx) => {
      const member = await tx.member.findFirst({
        where: { boardId, profileId: profile.id },
        select: { role: true },
      });

      if (!member) {
        throw new Error("NOT_A_MEMBER");
      }

      if (
        member.role !== MemberRole.OWNER &&
        member.role !== MemberRole.ADMIN
      ) {
        throw new Error("FORBIDDEN");
      }

      const boardExists = await tx.board.findUnique({ where: { id: boardId }, select: { id: true } });
      if (!boardExists) {
        throw new Error("NOT_FOUND");
      }

      return tx.board.update({
        where: { id: boardId },
        data: {
          ...(name !== undefined && { name: (name as string).trim() }),
          ...(resolvedImageAssetId !== undefined && {
            imageAssetId: resolvedImageAssetId,
          }),
          ...(description !== undefined && {
            description: description ? (description as string).trim() : null,
          }),
          ...(isPrivate !== undefined && { isPrivate: isPrivate as boolean }),
        },
        select: {
          id: true,
          name: true,
          description: true,
          imageAsset: {
            select: uploadedAssetSummarySelect,
          },
          inviteCode: true,
          inviteEnabled: true,
          isPrivate: true,
          profileId: true,
          createdAt: true,
          refreshedAt: true,
          updatedAt: true,
          languages: true,
          hiddenFromFeed: true,
          reportCount: true,
        },
      });
    });

    revalidatePath(`/boards/${boardId}`);
    revalidatePath("/boards");

    return NextResponse.json({
      ...board,
      imageAsset: serializeUploadedAsset(board.imageAsset),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_A_MEMBER") {
        return NextResponse.json({ error: "Not a member" }, { status: 403 });
      }

      if (error.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Board not found" }, { status: 404 });
      }

      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          { error: "Only owner or admin can edit board settings" },
          { status: 403 },
        );
      }

    }

    console.error("[BOARD_ID_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
