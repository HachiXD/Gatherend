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

    await db.$transaction(async (tx) => {
      const member = await tx.member.findFirst({
        where: { boardId, profileId: profile.id },
        select: { role: true },
      });

      if (!member) {
        throw new Error("NOT_A_MEMBER");
      }

      if (member.role !== MemberRole.OWNER) {
        throw new Error("FORBIDDEN");
      }

      await tx.board.delete({
        where: { id: boardId },
      });
    });

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
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { name, imageAssetId, description } = body;

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
