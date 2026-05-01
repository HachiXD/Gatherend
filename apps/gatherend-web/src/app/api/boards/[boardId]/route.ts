import {
  MemberRole,
  AssetContext,
  AssetVisibility,
} from "@prisma/client";
import { NextResponse } from "next/server";
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
  ensurePublicBoardNameAvailable,
  isPublicBoardNameUniqueConstraintError,
  PUBLIC_BOARD_NAME_CONFLICT_ERROR,
} from "@/lib/boards/public-name";
import {
  deleteBoardAndCollectState,
  invalidateDeletedBoardState,
  notifyBoardDeleted,
} from "@/lib/board-deletion";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
        bannerAsset: {
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
        _count: {
          select: { members: true },
        },
        members: {
          where: { profileId: profile.id },
          select: {
            id: true,
            role: true,
            profileId: true,
            boardId: true,
            level: true,
            xp: true,
            createdAt: true,
            updatedAt: true,
          },
          take: 1,
        },
      },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    const { members, _count, channels, imageAsset, bannerAsset, ...boardData } = board;
    const currentMember = members[0] ?? null;

    return NextResponse.json({
      ...boardData,
      imageAsset: serializeUploadedAsset(imageAsset),
      bannerAsset: serializeUploadedAsset(bannerAsset),
      memberCount: _count.members,
      currentMember,
      channels: channels.map((channel) => ({
        ...channel,
        imageAsset: serializeUploadedAsset(channel.imageAsset),
        channelMemberCount: channel._count.channelMembers,
        isJoined: channel.channelMembers.length > 0,
        _count: undefined,
        channelMembers: undefined,
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

      return deleteBoardAndCollectState(tx, boardId);
    });

    await invalidateDeletedBoardState(
      boardId,
      result.memberProfileIds,
      result.channelIds,
    );

    void notifyBoardDeleted(boardId, result.memberProfileIds, profile.id);

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
      bannerAssetId?: unknown;
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
      bannerAssetId,
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

    let resolvedBannerAssetId: string | null | undefined = undefined;
    if (bannerAssetId !== undefined) {
      if (bannerAssetId === null || bannerAssetId === "") {
        resolvedBannerAssetId = null;
      } else if (
        typeof bannerAssetId !== "string" ||
        !UUID_REGEX.test(bannerAssetId)
      ) {
        return NextResponse.json(
          { error: "Banner asset ID must be a valid UUID" },
          { status: 400 },
        );
      } else {
        const bannerAsset = await findOwnedUploadedAsset(
          bannerAssetId,
          profile.id,
          AssetContext.BOARD_BANNER,
          AssetVisibility.PUBLIC,
        );

        if (!bannerAsset) {
          return NextResponse.json(
            { error: "Board banner asset not found" },
            { status: 400 },
          );
        }

        resolvedBannerAssetId = bannerAsset.id;
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

      const boardExists = await tx.board.findUnique({
        where: { id: boardId },
        select: {
          id: true,
          name: true,
          isPrivate: true,
        },
      });
      if (!boardExists) {
        throw new Error("NOT_FOUND");
      }

      if (
        isPrivate !== undefined &&
        (isPrivate as boolean) !== boardExists.isPrivate
      ) {
        throw new Error("BOARD_PRIVACY_IMMUTABLE");
      }

      const nextName =
        name !== undefined ? (name as string).trim() : boardExists.name;
      const nextIsPrivate = boardExists.isPrivate;

      await ensurePublicBoardNameAvailable(tx, {
        name: nextName,
        isPrivate: nextIsPrivate,
        excludeBoardId: boardId,
      });

      return tx.board.update({
        where: { id: boardId },
        data: {
          ...(name !== undefined && { name: (name as string).trim() }),
          ...(resolvedImageAssetId !== undefined && {
            imageAssetId: resolvedImageAssetId,
          }),
          ...(resolvedBannerAssetId !== undefined && {
            bannerAssetId: resolvedBannerAssetId,
          }),
          ...(description !== undefined && {
            description: description ? (description as string).trim() : null,
          }),
        },
        select: {
          id: true,
          name: true,
          description: true,
          imageAsset: {
            select: uploadedAssetSummarySelect,
          },
          bannerAsset: {
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
      bannerAsset: serializeUploadedAsset(board.bannerAsset),
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

      if (error.message === "BOARD_PRIVACY_IMMUTABLE") {
        return NextResponse.json(
          { error: "Board privacy cannot be changed after creation" },
          { status: 400 },
        );
      }

      if (error.message === PUBLIC_BOARD_NAME_CONFLICT_ERROR) {
        return NextResponse.json(
          { error: "A public board with this name already exists" },
          { status: 409 },
        );
      }
    }

    if (isPublicBoardNameUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: "A public board with this name already exists" },
        { status: 409 },
      );
    }

    console.error("[BOARD_ID_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
