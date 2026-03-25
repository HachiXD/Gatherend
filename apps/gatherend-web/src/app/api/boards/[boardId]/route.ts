import { MemberRole, AssetContext, AssetVisibility, SlotMode } from "@prisma/client";
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
const MAX_CONFIGURABLE_SEATS = 48;

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
          where: { parentId: null },
          orderBy: { position: "asc" },
        },
        categories: {
          orderBy: { position: "asc" },
          include: {
            channels: {
              orderBy: { position: "asc" },
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
        slots: {
          include: {
            member: {
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
      members: board.members.map((member) => ({
        ...member,
        profile: serializeProfile(member.profile),
      })),
      slots: board.slots.map((slot) => ({
        ...slot,
        member: slot.member
          ? {
              ...slot.member,
              profile: serializeProfile(slot.member.profile),
            }
          : null,
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
      publicSeats?: unknown;
      invitationSeats?: unknown;
      communityId?: unknown;
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
      publicSeats,
      invitationSeats,
      communityId,
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

    if (
      publicSeats !== undefined &&
      (typeof publicSeats !== "number" ||
        !Number.isInteger(publicSeats) ||
        publicSeats < 0 ||
        publicSeats > MAX_CONFIGURABLE_SEATS)
    ) {
      return NextResponse.json(
        { error: "Public seats must be a valid integer" },
        { status: 400 },
      );
    }

    if (
      invitationSeats !== undefined &&
      (typeof invitationSeats !== "number" ||
        !Number.isInteger(invitationSeats) ||
        invitationSeats < 0 ||
        invitationSeats > MAX_CONFIGURABLE_SEATS)
    ) {
      return NextResponse.json(
        { error: "Invitation seats must be a valid integer" },
        { status: 400 },
      );
    }

    let normalizedCommunityId: string | null | undefined = undefined;
    if (communityId !== undefined) {
      if (communityId === null || communityId === "") {
        normalizedCommunityId = null;
      } else if (typeof communityId !== "string" || !UUID_REGEX.test(communityId)) {
        return NextResponse.json(
          { error: "Invalid community ID format" },
          { status: 400 },
        );
      } else {
        normalizedCommunityId = communityId;
      }
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

    if (typeof normalizedCommunityId === "string") {
      const communityExists = await db.community.findUnique({
        where: { id: normalizedCommunityId },
        select: { id: true },
      });

      if (!communityExists) {
        return NextResponse.json(
          { error: "Community not found" },
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

      const currentBoard = await tx.board.findUnique({
        where: { id: boardId },
        select: {
          communityId: true,
          slots: {
            select: {
              id: true,
              mode: true,
              memberId: true,
            },
          },
        },
      });

      if (!currentBoard) {
        throw new Error("NOT_FOUND");
      }

      const currentInvitation = currentBoard.slots.filter(
        (slot) => slot.mode === SlotMode.BY_INVITATION,
      );
      const currentDiscovery = currentBoard.slots.filter(
        (slot) => slot.mode === SlotMode.BY_DISCOVERY,
      );

      const currentPublicSeats = currentDiscovery.length;
      const currentInvitationSeats = Math.max(0, currentInvitation.length - 1);
      const effectivePublicSeats =
        publicSeats !== undefined ? publicSeats : currentPublicSeats;
      const effectiveInvitationSeats =
        invitationSeats !== undefined
          ? invitationSeats
          : currentInvitationSeats;
      const effectiveInvitationCount = effectiveInvitationSeats + 1;
      const effectiveCommunityId =
        normalizedCommunityId !== undefined
          ? normalizedCommunityId
          : currentBoard.communityId;

      if (
        effectivePublicSeats + effectiveInvitationSeats >
        MAX_CONFIGURABLE_SEATS
      ) {
        throw new Error("EXCEEDS_MAX_SIZE");
      }

      if (effectivePublicSeats > 0 && effectivePublicSeats < 4) {
        throw new Error("INVALID_DISCOVERY_MIN");
      }

      if (effectivePublicSeats > 0 && !effectiveCommunityId) {
        throw new Error("COMMUNITY_REQUIRED");
      }

      if (effectivePublicSeats === 0 && effectiveCommunityId) {
        throw new Error("COMMUNITY_NOT_ALLOWED");
      }

      const occupiedInvitation = currentInvitation.filter(
        (slot) => slot.memberId !== null,
      ).length;
      const occupiedDiscovery = currentDiscovery.filter(
        (slot) => slot.memberId !== null,
      ).length;

      if (effectiveInvitationCount < occupiedInvitation) {
        throw new Error("BELOW_OCCUPIED_INVITATION");
      }

      if (effectivePublicSeats < occupiedDiscovery) {
        throw new Error("BELOW_OCCUPIED_DISCOVERY");
      }

      const freeInvitation = currentInvitation.filter(
        (slot) => slot.memberId === null,
      );
      const freeDiscovery = currentDiscovery.filter(
        (slot) => slot.memberId === null,
      );

      const invitationDelta = effectiveInvitationCount - currentInvitation.length;
      const discoveryDelta = effectivePublicSeats - currentDiscovery.length;
      const toConvertInvToDisc: string[] = [];
      const toConvertDiscToInv: string[] = [];
      const toDelete: string[] = [];

      if (invitationDelta < 0) {
        const excess = Math.abs(invitationDelta);
        const canConvert = Math.min(
          freeInvitation.length,
          excess,
          Math.max(0, discoveryDelta),
        );

        for (let i = 0; i < canConvert; i++) {
          toConvertInvToDisc.push(freeInvitation[i].id);
        }

        const toDeleteCount = excess - canConvert;
        for (
          let i = canConvert;
          i < canConvert + toDeleteCount && i < freeInvitation.length;
          i++
        ) {
          toDelete.push(freeInvitation[i].id);
        }
      }

      if (discoveryDelta < 0) {
        const excess = Math.abs(discoveryDelta);
        const effectiveInvitationNeed = Math.max(
          0,
          invitationDelta - toConvertInvToDisc.length,
        );
        const canConvert = Math.min(
          freeDiscovery.length,
          excess,
          effectiveInvitationNeed,
        );

        for (let i = 0; i < canConvert; i++) {
          toConvertDiscToInv.push(freeDiscovery[i].id);
        }

        const toDeleteCount = excess - canConvert;
        for (
          let i = canConvert;
          i < canConvert + toDeleteCount && i < freeDiscovery.length;
          i++
        ) {
          toDelete.push(freeDiscovery[i].id);
        }
      }

      if (toConvertInvToDisc.length > 0) {
        await tx.slot.updateMany({
          where: { id: { in: toConvertInvToDisc } },
          data: { mode: SlotMode.BY_DISCOVERY },
        });
      }

      if (toConvertDiscToInv.length > 0) {
        await tx.slot.updateMany({
          where: { id: { in: toConvertDiscToInv } },
          data: { mode: SlotMode.BY_INVITATION },
        });
      }

      if (toDelete.length > 0) {
        await tx.slot.deleteMany({
          where: { id: { in: toDelete } },
        });
      }

      const afterInvitation =
        currentInvitation.length -
        toConvertInvToDisc.length -
        toDelete.filter((id) => freeInvitation.some((slot) => slot.id === id))
          .length +
        toConvertDiscToInv.length;

      const afterDiscovery =
        currentDiscovery.length -
        toConvertDiscToInv.length -
        toDelete.filter((id) => freeDiscovery.some((slot) => slot.id === id))
          .length +
        toConvertInvToDisc.length;

      const createInvitation = Math.max(
        0,
        effectiveInvitationCount - afterInvitation,
      );
      const createDiscovery = Math.max(0, effectivePublicSeats - afterDiscovery);

      if (createInvitation > 0) {
        await tx.slot.createMany({
          data: Array.from({ length: createInvitation }, () => ({
            boardId,
            mode: SlotMode.BY_INVITATION,
          })),
        });
      }

      if (createDiscovery > 0) {
        await tx.slot.createMany({
          data: Array.from({ length: createDiscovery }, () => ({
            boardId,
            mode: SlotMode.BY_DISCOVERY,
          })),
        });
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
          size: effectivePublicSeats + effectiveInvitationCount,
          communityId: effectiveCommunityId,
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
          size: true,
          profileId: true,
          createdAt: true,
          refreshedAt: true,
          updatedAt: true,
          languages: true,
          hiddenFromFeed: true,
          reportCount: true,
          communityId: true,
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

      if (error.message === "EXCEEDS_MAX_SIZE") {
        return NextResponse.json(
          { error: "Total seats exceed maximum board size" },
          { status: 400 },
        );
      }

      if (error.message === "INVALID_DISCOVERY_MIN") {
        return NextResponse.json(
          { error: "Public groups must have at least 4 public slots" },
          { status: 400 },
        );
      }

      if (error.message === "COMMUNITY_REQUIRED") {
        return NextResponse.json(
          { error: "Community is required when public seats are enabled" },
          { status: 400 },
        );
      }

      if (error.message === "COMMUNITY_NOT_ALLOWED") {
        return NextResponse.json(
          { error: "Private boards cannot be assigned to a community" },
          { status: 400 },
        );
      }

      if (error.message === "BELOW_OCCUPIED_INVITATION") {
        return NextResponse.json(
          { error: "Cannot reduce invitation slots below occupied count" },
          { status: 400 },
        );
      }

      if (error.message === "BELOW_OCCUPIED_DISCOVERY") {
        return NextResponse.json(
          { error: "Cannot reduce discovery slots below occupied count" },
          { status: 400 },
        );
      }
    }

    console.error("[BOARD_ID_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
