// app/api/boards/[boardId]/channels/route.ts

import { db } from "@/lib/db";
import { MemberRole, ChannelType } from "@prisma/client";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

async function notifyChannelCreated(
  boardId: string,
  channel: {
    id: string;
    name: string;
    type: ChannelType;
    position: number;
    boardId: string;
    imageAssetId: string | null;
    profileId: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
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
            ...channel,
            createdAt: channel.createdAt.toISOString(),
            updatedAt: channel.updatedAt.toISOString(),
            imageAsset: null,
            channelMemberCount: 0,
            isJoined: false,
          },
          timestamp: Date.now(),
        },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (error) {
    console.error("[NOTIFY_CHANNEL_CREATED]", error);
  }
}

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    // Validar imageAssetId si se proporciona
    if (imageAssetId !== undefined && imageAssetId !== null) {
      if (typeof imageAssetId !== "string" || !UUID_REGEX.test(imageAssetId)) {
        return NextResponse.json(
          { error: "Invalid image asset ID" },
          { status: 400 },
        );
      }
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
    const channel = await db.$transaction(async (tx) => {
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

      const firstChannel = await tx.channel.findFirst({
        where: { boardId },
        orderBy: { position: "asc" },
      });

      const firstPos = firstChannel?.position ?? 1000;
      const newPosition = firstPos - 1000;

      // Crear canal
      return tx.channel.create({
        data: {
          name: (name as string).trim(),
          type: type as ChannelType,
          boardId,
          position: newPosition,
          profileId: profile.id,
          imageAssetId: (imageAssetId as string | null) ?? null,
        },
      });
    });

    // Invalidar cache del layout para forzar re-render
    revalidatePath(`/boards/${boardId}`);

    void notifyChannelCreated(boardId, channel);

    return NextResponse.json(channel);
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
