// app/api/boards/[boardId]/channels/[channelId]/route.ts

import { db } from "@/lib/db";
import { MemberRole, ChannelType } from "@prisma/client";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

      if (channel.type === ChannelType.MAIN) {
        throw new Error("CANNOT_DELETE_MAIN_CHANNEL");
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
      if (error.message === "CANNOT_DELETE_MAIN_CHANNEL")
        return NextResponse.json(
          { error: "Cannot delete the main channel" },
          { status: 400 },
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
    let body: { name?: unknown; type?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { name, type } = body;

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
        // No permitir cambiar tipo de canal MAIN
        if (channel.type === ChannelType.MAIN) {
          throw new Error("CANNOT_MODIFY_MAIN_CHANNEL");
        }

        // No permitir establecer tipo MAIN
        if (type === ChannelType.MAIN) {
          throw new Error("CANNOT_SET_TYPE_TO_MAIN");
        }

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
        },
      });
    });

    // Invalidar cache del layout para forzar re-render
    revalidatePath(`/boards/${boardId}`);

    return NextResponse.json(updatedChannel);
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
      if (error.message === "CANNOT_MODIFY_MAIN_CHANNEL")
        return NextResponse.json(
          { error: "Cannot modify the main channel type" },
          { status: 400 },
        );
      if (error.message === "CANNOT_SET_TYPE_TO_MAIN")
        return NextResponse.json(
          { error: "Cannot set channel type to MAIN" },
          { status: 400 },
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
