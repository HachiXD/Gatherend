import { v4 as uuidv4 } from "uuid";
import {
  AssetContext,
  AssetVisibility,
  ChannelType,
  Languages,
  MemberRole,
} from "@prisma/client";
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
          members: {
            create: {
              profileId: profile.id,
              role: MemberRole.OWNER,
            },
          },
          channels: {
            createMany: {
              data: [
                {
                  name: "Main",
                  type: ChannelType.TEXT,
                  profileId: profile.id,
                },
                {
                  name: "VR",
                  type: ChannelType.VOICE,
                  profileId: profile.id,
                },
              ],
            },
          },
        },
        select: { id: true },
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
          channels: true,
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
    console.error("[BOARD_CREATE_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
