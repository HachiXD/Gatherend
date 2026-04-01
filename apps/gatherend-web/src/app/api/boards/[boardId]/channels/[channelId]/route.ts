// app/api/boards/[boardId]/channels/[channelId]/route.ts

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

async function notifyChannelEvent(
  boardId: string,
  event: "board:channel-deleted" | "board:channel-updated",
  data: Record<string, unknown>,
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
        event,
        data: { boardId, ...data, timestamp: Date.now() },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (error) {
    console.error(`[${event.toUpperCase()}]`, error);
  }
}

// DELETE - Eliminar un canal

export async function DELETE(
  req: Request,
  context: { params: Promise<{ boardId: string; channelId: string }> },
) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const params = await context.params;
    const { boardId, channelId } = params;

    // Validate UUIDs
    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    if (!channelId || !UUID_REGEX.test(channelId)) {
      return NextResponse.json(
        { error: "Invalid channel ID" },
        { status: 400 },
      );
    }

    // Ejecutar toda la lógica en una transacción para consistencia
    await db.$transaction(async (tx) => {
      // Verificar permisos y canal en paralelo
      const [member, channel] = await Promise.all([
        tx.member.findFirst({
          where: {
            boardId,
            profileId: profile.id,
            role: { in: [MemberRole.OWNER, MemberRole.ADMIN] },
          },
          select: { role: true },
        }),
        tx.channel.findFirst({
          where: { id: channelId, boardId },
        }),
      ]);

      if (!member) {
        throw new Error("FORBIDDEN");
      }

      if (!channel) {
        throw new Error("CHANNEL_NOT_FOUND");
      }

      // Verificar que no sea el último canal de TEXTO del board
      if (channel.type === ChannelType.TEXT) {
        const textChannels = await tx.channel.count({
          where: { boardId, type: ChannelType.TEXT },
        });

        if (textChannels <= 1) {
          throw new Error("LAST_TEXT_CHANNEL");
        }
      }

      // Eliminar el canal
      await tx.channel.delete({
        where: { id: channelId },
      });
    });

    // Invalidar cache del layout para forzar re-render
    revalidatePath(`/boards/${boardId}`);

    void notifyChannelEvent(boardId, "board:channel-deleted", { channelId });

    return NextResponse.json({ success: true });
  } catch (error) {
    // Manejar errores personalizados lanzados desde la transacción
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN")
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 },
        );
      if (error.message === "CHANNEL_NOT_FOUND")
        return NextResponse.json(
          { error: "Channel not found" },
          { status: 404 },
        );
      if (error.message === "LAST_TEXT_CHANNEL")
        return NextResponse.json(
          { error: "Cannot delete the last text channel" },
          { status: 400 },
        );
    }

    console.error("[CHANNEL_ID_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// PATCH - Actualizar un canal

export async function PATCH(
  req: Request,
  context: { params: Promise<{ boardId: string; channelId: string }> },
) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const params = await context.params;
    const { boardId, channelId } = params;

    // Validate UUIDs
    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    if (!channelId || !UUID_REGEX.test(channelId)) {
      return NextResponse.json(
        { error: "Invalid channel ID" },
        { status: 400 },
      );
    }

    // Parse body with error handling
    let body: { name?: unknown; type?: unknown; imageAssetId?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { name, type, imageAssetId } = body;

    // Validar name si se proporciona
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Channel name must be a non-empty string" },
          { status: 400 },
        );
      }
      if (name.length > 50) {
        return NextResponse.json(
          { error: "Channel name cannot exceed 50 characters" },
          { status: 400 },
        );
      }
    }

    // Validar type si se proporciona
    const validTypes = Object.values(ChannelType);
    if (type !== undefined && !validTypes.includes(type as ChannelType)) {
      return NextResponse.json(
        { error: "Invalid channel type" },
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
          { error: "Invalid image asset ID" },
          { status: 400 },
        );
      } else {
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
    }

    // Ejecutar verificación de permisos y actualización en transacción
    const updatedChannel = await db.$transaction(async (tx) => {
      // Verificar permisos y canal en paralelo
      const [member, channel] = await Promise.all([
        tx.member.findFirst({
          where: {
            boardId,
            profileId: profile.id,
            role: { in: [MemberRole.OWNER, MemberRole.ADMIN] },
          },
          select: { role: true },
        }),
        tx.channel.findFirst({
          where: { id: channelId, boardId },
        }),
      ]);

      if (!member) {
        throw new Error("FORBIDDEN");
      }

      if (!channel) {
        throw new Error("CHANNEL_NOT_FOUND");
      }

      const isTypeChange =
        type !== undefined && (type as ChannelType) !== channel.type;

      // Validaciones de tipo solo si realmente se intenta cambiar
      if (isTypeChange) {
        // Si cambia de TEXT a otro tipo, verificar que no sea el último
        if (channel.type === ChannelType.TEXT && type !== ChannelType.TEXT) {
          const textChannels = await tx.channel.count({
            where: { boardId, type: ChannelType.TEXT },
          });

          if (textChannels <= 1) {
            throw new Error("LAST_TEXT_CHANNEL");
          }
        }
      }

      // Actualizar el canal
      return tx.channel.update({
        where: { id: channelId },
        data: {
          ...(name !== undefined && { name: (name as string).trim() }),
          ...(isTypeChange && { type: type as ChannelType }),
          ...(resolvedImageAssetId !== undefined && {
            imageAssetId: resolvedImageAssetId,
          }),
        },
        select: getBoardChannelSelect(profile.id),
      });
    });

    // Invalidar cache del layout para forzar re-render
    revalidatePath(`/boards/${boardId}`);

    const serializedChannel = serializeBoardChannel(updatedChannel);

    void notifyChannelEvent(boardId, "board:channel-updated", {
      channel: {
        id: serializedChannel.id,
        name: serializedChannel.name,
        type: serializedChannel.type,
        imageAsset: serializedChannel.imageAsset,
        updatedAt: serializedChannel.updatedAt.toISOString(),
      },
    });

    return NextResponse.json(serializedChannel);
  } catch (error) {
    // Manejar errores personalizados lanzados desde la transacción
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN")
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 },
        );
      if (error.message === "CHANNEL_NOT_FOUND")
        return NextResponse.json(
          { error: "Channel not found" },
          { status: 404 },
        );
      if (error.message === "LAST_TEXT_CHANNEL")
        return NextResponse.json(
          { error: "Cannot change the last text channel type" },
          { status: 400 },
        );
    }

    console.error("[CHANNEL_ID_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
