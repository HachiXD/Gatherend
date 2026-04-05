import { v4 as uuidv4 } from "uuid";
import {
  AssetContext,
  AssetVisibility,
  Languages,
  MemberRole,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { canCreateBoard } from "@/lib/domain";
import {
  createAccessDeniedResponse,
  getProfileReputationScore,
} from "@/lib/domain-access";
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
import { createDefaultBoardChannelsForOwner } from "@/lib/boards/default-channels";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const boards = await db.board.findMany({
      where: {
        members: {
          some: {
            profileId: profile.id,
          },
        },
      },
      select: {
        id: true,
        name: true,
        imageAsset: {
          select: uploadedAssetSummarySelect,
        },
        channels: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json(
      boards.map((board) => ({
        ...board,
        imageAsset: serializeUploadedAsset(board.imageAsset),
      })),
    );
  } catch (error) {
    console.error("[BOARDS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.boardCreate);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;
    const reputationScore = getProfileReputationScore(profile.reputationScore);

    const boardDecision = canCreateBoard(reputationScore);
    if (!boardDecision.allowed) {
      return createAccessDeniedResponse(boardDecision);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const {
      name,
      description,
      imageAssetId,
      isPrivate,
    }: {
      name?: unknown;
      description?: unknown;
      imageAssetId?: unknown;
      isPrivate?: unknown;
    } = body;

    const languagesNorm: Languages[] =
      profile.languages && profile.languages.length > 0
        ? profile.languages
        : ["EN"];

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Board name is required (min 2 characters)" },
        { status: 400 },
      );
    }

    if (name.trim().length > 50) {
      return NextResponse.json(
        { error: "Board name must be 50 characters or less" },
        { status: 400 },
      );
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
          { error: "Description must be 300 characters or less" },
          { status: 400 },
        );
      }
    }

    const resolvedIsPrivate = isPrivate === false ? false : true;

    if (description && description.trim().length > 0) {
      const moderationResult = moderateDescription(description);
      if (!moderationResult.allowed) {
        return NextResponse.json(
          {
            error: "MODERATION_BLOCKED",
            message:
              moderationResult.message ||
              "Description contains prohibited content",
            reason: moderationResult.reason,
          },
          { status: 400 },
        );
      }
    }

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

    let resolvedImageAssetId: string | null = null;
    if (imageAssetId !== undefined && imageAssetId !== null && imageAssetId !== "") {
      if (typeof imageAssetId !== "string" || !UUID_REGEX.test(imageAssetId)) {
        return NextResponse.json(
          { error: "Image asset ID must be a valid UUID" },
          { status: 400 },
        );
      }

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

    const board = await db.$transaction(async (tx) => {
      await ensurePublicBoardNameAvailable(tx, {
        name: name.trim(),
        isPrivate: resolvedIsPrivate,
      });

      const newBoard = await tx.board.create({
        data: {
          name: name.trim(),
          description:
            typeof description === "string" && description.trim().length > 0
              ? description.trim()
              : null,
          imageAssetId: resolvedImageAssetId,
          isPrivate: resolvedIsPrivate,
          languages: languagesNorm,
          profileId: profile.id,
          inviteCode: uuidv4(),
          refreshedAt: new Date(),
        },
        select: { id: true },
      });

      const ownerMember = await tx.member.create({
        data: {
          boardId: newBoard.id,
          profileId: profile.id,
          role: MemberRole.OWNER,
        },
        select: {
          id: true,
        },
      });

      await createDefaultBoardChannelsForOwner(tx, {
        boardId: newBoard.id,
        ownerMemberId: ownerMember.id,
        ownerProfileId: profile.id,
      });

      return tx.board.findUnique({
        where: { id: newBoard.id },
        select: {
          id: true,
          name: true,
          description: true,
          inviteCode: true,
          inviteEnabled: true,
          isPrivate: true,
          profileId: true,
          createdAt: true,
          imageAsset: {
            select: uploadedAssetSummarySelect,
          },
          members: true,
          channels: {
            orderBy: {
              position: "asc",
            },
          },
        },
      });
    });

    revalidatePath("/boards");

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...board,
      imageAsset: serializeUploadedAsset(board.imageAsset),
    });
  } catch (error) {
    if (
      (error instanceof Error &&
        error.message === PUBLIC_BOARD_NAME_CONFLICT_ERROR) ||
      isPublicBoardNameUniqueConstraintError(error)
    ) {
      return NextResponse.json(
        { error: "A public board with this name already exists" },
        { status: 409 },
      );
    }

    console.error("[BOARD_CREATE_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
