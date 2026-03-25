import { v4 as uuidv4 } from "uuid";
import {
  AssetContext,
  AssetVisibility,
  ChannelType,
  Languages,
  MemberRole,
  SlotMode,
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

const MAX_SEATS = 48;

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

    const boardIds = boards.map((board) => board.id);

    const mainChannels = await db.channel.findMany({
      where: {
        boardId: { in: boardIds },
        type: ChannelType.MAIN,
      },
      select: {
        boardId: true,
        id: true,
      },
    });

    const mainChannelIdByBoardId = new Map<string, string>();
    for (const channel of mainChannels) {
      if (!mainChannelIdByBoardId.has(channel.boardId)) {
        mainChannelIdByBoardId.set(channel.boardId, channel.id);
      }
    }

    return NextResponse.json(
      boards.map((board) => ({
        ...board,
        imageAsset: serializeUploadedAsset(board.imageAsset),
        mainChannelId: mainChannelIdByBoardId.get(board.id) ?? null,
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
      publicSeats,
      invitationSeats,
      communityId,
    }: {
      name?: unknown;
      description?: unknown;
      imageAssetId?: unknown;
      publicSeats?: unknown;
      invitationSeats?: unknown;
      communityId?: unknown;
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

    if (
      typeof publicSeats !== "number" ||
      typeof invitationSeats !== "number" ||
      !Number.isInteger(publicSeats) ||
      !Number.isInteger(invitationSeats)
    ) {
      return NextResponse.json(
        { error: "Seats must be integer numbers" },
        { status: 400 },
      );
    }

    if (publicSeats < 0 || invitationSeats < 0) {
      return NextResponse.json(
        { error: "Seats cannot be negative" },
        { status: 400 },
      );
    }

    if (publicSeats > 0 && publicSeats < 4) {
      return NextResponse.json(
        { error: "Public seats must be at least 4 or 0" },
        { status: 400 },
      );
    }

    const totalSeats = publicSeats + invitationSeats;
    if (totalSeats > MAX_SEATS) {
      return NextResponse.json(
        { error: `Total seats cannot exceed ${MAX_SEATS}` },
        { status: 400 },
      );
    }

    if (communityId !== undefined && communityId !== null && communityId !== "") {
      if (typeof communityId !== "string" || !UUID_REGEX.test(communityId)) {
        return NextResponse.json(
          { error: "Invalid community ID format" },
          { status: 400 },
        );
      }
    }

    if (publicSeats > 0 && !communityId) {
      return NextResponse.json(
        { error: "Community is required when public seats are enabled" },
        { status: 400 },
      );
    }

    if (publicSeats === 0 && communityId) {
      return NextResponse.json(
        { error: "Private boards cannot be assigned to a community" },
        { status: 400 },
      );
    }

    if (typeof communityId === "string" && communityId.trim().length > 0) {
      const communityExists = await db.community.findUnique({
        where: { id: communityId },
        select: { id: true },
      });

      if (!communityExists) {
        return NextResponse.json(
          { error: "Community not found" },
          { status: 400 },
        );
      }
    }

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

    const size = totalSeats + 1;

    const board = await db.$transaction(async (tx) => {
      const newBoard = await tx.board.create({
        data: {
          name: name.trim(),
          description:
            typeof description === "string" && description.trim().length > 0
              ? description.trim()
              : null,
          imageAssetId: resolvedImageAssetId,
          size,
          languages: languagesNorm,
          profileId: profile.id,
          inviteCode: uuidv4(),
          refreshedAt: new Date(),
          communityId:
            typeof communityId === "string" && communityId.trim().length > 0
              ? communityId
              : null,
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
                  type: ChannelType.MAIN,
                  profileId: profile.id,
                },
                {
                  name: "Text room",
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
        include: {
          members: true,
          channels: true,
        },
      });

      const ownerMember = newBoard.members.find(
        (member) => member.role === MemberRole.OWNER,
      );
      if (!ownerMember) {
        throw new Error("Owner member not created");
      }

      const slotsData: {
        boardId: string;
        mode: SlotMode;
        memberId: string | null;
      }[] = [
        {
          boardId: newBoard.id,
          mode: SlotMode.BY_INVITATION,
          memberId: ownerMember.id,
        },
      ];

      for (let i = 0; i < publicSeats; i++) {
        slotsData.push({
          boardId: newBoard.id,
          mode: SlotMode.BY_DISCOVERY,
          memberId: null,
        });
      }

      for (let i = 0; i < invitationSeats; i++) {
        slotsData.push({
          boardId: newBoard.id,
          mode: SlotMode.BY_INVITATION,
          memberId: null,
        });
      }

      await tx.slot.createMany({ data: slotsData });

      return tx.board.findUnique({
        where: { id: newBoard.id },
        select: {
          id: true,
          name: true,
          description: true,
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
          imageAsset: {
            select: uploadedAssetSummarySelect,
          },
          slots: true,
          members: true,
          channels: true,
        },
      });
    });

    revalidatePath("/boards");

    if (board?.communityId) {
      const socketUrl = `${process.env.SOCKET_SERVER_URL}/emit-to-room`;
      const roomName = `discovery:community:${board.communityId}`;

      fetch(socketUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": process.env.INTERNAL_API_SECRET || "",
        },
        body: JSON.stringify({
          room: roomName,
          event: "discovery:board-created",
          data: { communityId: board.communityId, boardId: board.id },
        }),
        signal: AbortSignal.timeout(3000),
      }).catch((error) => {
        console.error("Error emitiendo discovery:board-created:", error);
      });
    }

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
