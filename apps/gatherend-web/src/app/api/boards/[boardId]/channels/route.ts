// app/api/boards/[boardId]/channels/route.ts

import { db } from "@/lib/db";
import {
  AssetContext,
  AssetVisibility,
  MemberRole,
  ChannelType,
  type Prisma,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import {
  UUID_REGEX,
  findOwnedUploadedAsset,
  serializeUploadedAsset,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";
import {
  reserveChannelMessageSeqRange,
  upsertBoardReadStatesForChannel,
} from "@/lib/channels/read-state";

const getBoardChannelSelect = (profileId: string) =>
  ({
    id: true,
    name: true,
    type: true,
    position: true,
    boardId: true,
    createdAt: true,
    updatedAt: true,
    imageAsset: {
      select: uploadedAssetSummarySelect,
    },
    _count: {
      select: { channelMembers: true },
    },
    channelMembers: {
      where: { profileId },
      select: { id: true },
      take: 1,
    },
  }) satisfies Prisma.ChannelSelect;

type RawBoardChannel = Prisma.ChannelGetPayload<{
  select: ReturnType<typeof getBoardChannelSelect>;
}>;

type SerializedBoardChannel = ReturnType<typeof serializeBoardChannel>;

function serializeBoardChannel(channel: RawBoardChannel) {
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    position: channel.position,
    boardId: channel.boardId,
    imageAsset: serializeUploadedAsset(channel.imageAsset),
    channelMemberCount: channel._count.channelMembers,
    isJoined: channel.channelMembers.length > 0,
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt,
  };
}

async function notifyChannelCreated(
  boardId: string,
  channel: SerializedBoardChannel,
  autoJoinedProfileIds: string[],
) {
  try {
    const socketUrl =
      process.env.SOCKET_SERVER_URL || process.env.NEXT_PUBLIC_SOCKET_URL;
    const secret = process.env.INTERNAL_API_SECRET;
    if (!socketUrl || !secret) return;

    await fetch(`${socketUrl}/emit-to-room`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": secret,
      },
      body: JSON.stringify({
        room: `board:${boardId}`,
        event: "board:channel-created",
        data: {
          boardId,
          channel: {
            id: channel.id,
            name: channel.name,
            type: channel.type,
            position: channel.position,
            boardId: channel.boardId,
            imageAsset: channel.imageAsset,
            channelMemberCount: channel.channelMemberCount,
            createdAt: channel.createdAt.toISOString(),
            updatedAt: channel.updatedAt.toISOString(),
          },
          autoJoinedProfileIds,
          timestamp: Date.now(),
        },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (error) {
    console.error("[NOTIFY_CHANNEL_CREATED]", error);
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const params = await context.params;
    const { boardId } = params;

    // Validate UUID
    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    // Parse body with error handling
    let body: { name?: unknown; type?: unknown; imageAssetId?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { name, type, imageAssetId } = body;

    // Validar name
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Channel name is required" },
        { status: 400 },
      );
    }

    if (name.length > 50) {
      return NextResponse.json(
        { error: "Channel name cannot exceed 50 characters" },
        { status: 400 },
      );
    }

    let resolvedImageAssetId: string | null = null;
    if (imageAssetId !== undefined && imageAssetId !== null && imageAssetId !== "") {
      if (typeof imageAssetId !== "string" || !UUID_REGEX.test(imageAssetId)) {
        return NextResponse.json(
          { error: "Invalid image asset ID" },
          { status: 400 },
        );
      }

      const imageAsset = await findOwnedUploadedAsset(
        imageAssetId,
        profile.id,
        AssetContext.CHANNEL_IMAGE,
        AssetVisibility.PUBLIC,
      );

      if (!imageAsset) {
        return NextResponse.json(
          { error: "Channel image asset not found" },
          { status: 400 },
        );
      }

      resolvedImageAssetId = imageAsset.id;
    }

    // Validar type
    const validTypes = Object.values(ChannelType);
    if (!type || !validTypes.includes(type as ChannelType)) {
      return NextResponse.json(
        { error: "Invalid channel type" },
        { status: 400 },
      );
    }

    // Ejecutar verificación de permisos y creación en transacción
    const result = await db.$transaction(async (tx) => {
      // Verificar permisos y contar canales en paralelo
      const [member, channelCount] = await Promise.all([
        tx.member.findFirst({
          where: {
            boardId,
            profileId: profile.id,
            role: { in: [MemberRole.OWNER, MemberRole.ADMIN] },
          },
          select: { role: true },
        }),
        tx.channel.count({ where: { boardId } }),
      ]);

      if (!member) {
        throw new Error("FORBIDDEN");
      }

      // Verificar límite de canales
      if (channelCount >= 250) {
        throw new Error("MAX_CHANNELS");
      }

      const [firstChannel, autoJoinMembers] = await Promise.all([
        tx.channel.findFirst({
          where: { boardId },
          orderBy: { position: "asc" },
        }),
        tx.member.findMany({
          where: {
            boardId,
            OR: [
              {
                role: {
                  in: [
                    MemberRole.OWNER,
                    MemberRole.ADMIN,
                    MemberRole.MODERATOR,
                  ],
                },
              },
              { profileId: profile.id },
            ],
          },
          select: {
            id: true,
            profileId: true,
          },
        }),
      ]);

      const firstPos = firstChannel?.position ?? 1000;
      const newPosition = firstPos - 1000;
      const uniqueAutoJoinMembers = Array.from(
        new Map(
          autoJoinMembers.map((boardMember) => [
            boardMember.profileId,
            boardMember,
          ]),
        ).values(),
      );

      // Crear canal
      const createdChannel = await tx.channel.create({
        data: {
          name: (name as string).trim(),
          type: type as ChannelType,
          boardId,
          position: newPosition,
          profileId: profile.id,
          imageAssetId: resolvedImageAssetId,
        },
        select: { id: true },
      });

      if (uniqueAutoJoinMembers.length > 0) {
        await tx.channelMember.createMany({
          data: uniqueAutoJoinMembers.map((boardMember) => ({
            channelId: createdChannel.id,
            profileId: boardMember.profileId,
          })),
          skipDuplicates: true,
        });

        const welcomeStartSeq = await reserveChannelMessageSeqRange(
          tx,
          createdChannel.id,
          uniqueAutoJoinMembers.length,
        );

        await tx.message.createMany({
          data: uniqueAutoJoinMembers.map((boardMember, index) => ({
            channelId: createdChannel.id,
            seq: welcomeStartSeq + index,
            type: "WELCOME",
            content: "",
            memberId: boardMember.id,
            messageSenderId: boardMember.profileId,
          })),
        });
      }

      const finalChannelState = await tx.channel.findUniqueOrThrow({
        where: { id: createdChannel.id },
        select: { lastMessageSeq: true },
      });

      await upsertBoardReadStatesForChannel(tx, {
        boardId,
        channelId: createdChannel.id,
        lastReadSeq: finalChannelState.lastMessageSeq,
      });

      const hydratedChannel = await tx.channel.findUniqueOrThrow({
        where: { id: createdChannel.id },
        select: getBoardChannelSelect(profile.id),
      });

      return {
        channel: hydratedChannel,
        autoJoinedProfileIds: uniqueAutoJoinMembers.map(
          (boardMember) => boardMember.profileId,
        ),
      };
    });

    // Invalidar cache del layout para forzar re-render
    revalidatePath(`/boards/${boardId}`);

    const serializedChannel = serializeBoardChannel(result.channel);

    void notifyChannelCreated(
      boardId,
      serializedChannel,
      result.autoJoinedProfileIds,
    );

    return NextResponse.json(serializedChannel);
  } catch (error) {
    // Manejar errores personalizados lanzados desde la transacción
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN")
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 },
        );
      if (error.message === "MAX_CHANNELS")
        return NextResponse.json(
          { error: "Maximum of 250 channels reached" },
          { status: 400 },
        );
    }

    console.error("[CHANNELS_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
