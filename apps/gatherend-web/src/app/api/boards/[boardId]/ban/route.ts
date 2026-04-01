import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { MemberRole } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { expressMemberCache } from "@/lib/redis";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function notifyBoardMembership(
  profileId: string,
  boardId: string,
  action: "join" | "leave",
) {
  try {
    const socketUrl =
      process.env.SOCKET_SERVER_URL || process.env.NEXT_PUBLIC_SOCKET_URL;
    const secret = process.env.INTERNAL_API_SECRET;
    if (!socketUrl || !secret) return;
    await fetch(`${socketUrl}/socket-membership`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": secret,
      },
      body: JSON.stringify({ profileId, boardId, action }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (error) {
    console.error("[NOTIFY_BOARD_MEMBERSHIP]", error);
  }
}

// Helper para notificar a los miembros restantes y al usuario baneado
async function notifyMemberBanned(boardId: string, profileId: string) {
  try {
    const socketUrl =
      process.env.SOCKET_SERVER_URL || process.env.NEXT_PUBLIC_SOCKET_URL;
    const secret = process.env.INTERNAL_API_SECRET;

    // Skip if socket URL or secret is not configured
    if (!socketUrl || !secret) return;

    const timestamp = Date.now();

    await Promise.allSettled([
      fetch(`${socketUrl}/emit-to-room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": secret,
        },
        body: JSON.stringify({
          room: `board:${boardId}`,
          event: "board:member-left",
          data: {
            boardId,
            profileId,
            reason: "banned",
            timestamp,
          },
        }),
        signal: AbortSignal.timeout(3000),
      }),
      fetch(`${socketUrl}/emit-to-room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": secret,
        },
        body: JSON.stringify({
          room: `board:${boardId}`,
          event: "board:member-banned",
          data: {
            boardId,
            profileId,
            timestamp,
          },
        }),
        signal: AbortSignal.timeout(3000),
      }),
      fetch(`${socketUrl}/emit-to-room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": secret,
        },
        body: JSON.stringify({
          room: `profile:${profileId}`,
          event: "board:banned",
          data: {
            boardId,
            bannedProfileId: profileId,
            timestamp,
          },
        }),
        signal: AbortSignal.timeout(3000),
      }),
    ]);
  } catch (error) {
    console.error("[NOTIFY_MEMBER_BANNED]", error);
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.moderation);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const params = await context.params;

    let body: { targetProfileId?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const targetProfileId = body.targetProfileId;

    const boardId = params.boardId;

    if (!boardId || typeof targetProfileId !== "string" || !targetProfileId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Validate UUIDs
    if (!UUID_REGEX.test(boardId) || !UUID_REGEX.test(targetProfileId)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    if (profile.id === targetProfileId) {
      return NextResponse.json(
        { error: "You cannot ban yourself" },
        { status: 400 },
      );
    }

    // Ejecutar toda la lógica dentro de una transacción para consistencia
    await db.$transaction(async (tx) => {
      // 1. Buscar al actor y al target DENTRO de la transacción
      const [actor, targetMember] = await Promise.all([
        tx.member.findFirst({
          where: { boardId, profileId: profile.id },
          select: { role: true },
        }),
        tx.member.findFirst({
          where: { boardId, profileId: targetProfileId },
          select: { id: true, role: true },
        }),
      ]);

      // 2. Validaciones de permisos
      if (!actor) {
        throw new Error("NOT_A_MEMBER");
      }

      if (actor.role !== MemberRole.OWNER && actor.role !== MemberRole.ADMIN) {
        throw new Error("FORBIDDEN");
      }

      // 3. El target debe ser miembro del board para poder banearlo
      if (!targetMember) {
        throw new Error("TARGET_NOT_MEMBER");
      }

      // 4. Reglas de jerarquía
      if (targetMember.role === MemberRole.OWNER) {
        throw new Error("CANNOT_BAN_OWNER");
      }

      if (
        actor.role === MemberRole.ADMIN &&
        targetMember.role === MemberRole.ADMIN
      ) {
        throw new Error("INSUFFICIENT_PERMISSIONS");
      }

      // 5. Expulsar al miembro
      await tx.channelMember.deleteMany({
        where: {
          profileId: targetProfileId,
          channel: { boardId },
        },
      });

      await tx.channelReadState.deleteMany({
        where: {
          profileId: targetProfileId,
          channel: { boardId },
        },
      });

      await tx.mention.deleteMany({
        where: {
          profileId: targetProfileId,
          message: {
            channel: { boardId },
          },
        },
      });

      await tx.member.delete({
        where: { id: targetMember.id },
      });

      // 6. Crear el registro de ban (idempotente)
      await tx.boardBan.upsert({
        where: {
          boardId_profileId: { boardId, profileId: targetProfileId },
        },
        update: {},
        create: { boardId, profileId: targetProfileId },
      });
    });

    await expressMemberCache.invalidate(boardId, targetProfileId);
    expressMemberCache.invalidateBoardIds(targetProfileId);

    // Notificar a los miembros restantes (fire-and-forget)
    notifyBoardMembership(targetProfileId, boardId, "leave");
    notifyMemberBanned(boardId, targetProfileId);

    return NextResponse.json({
      success: true,
      bannedProfileId: targetProfileId,
    });
  } catch (error) {
    // Manejar errores personalizados lanzados desde la transacción
    if (error instanceof Error) {
      if (error.message === "NOT_A_MEMBER")
        return NextResponse.json({ error: "Not a member" }, { status: 403 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (error.message === "TARGET_NOT_MEMBER")
        return NextResponse.json(
          { error: "User is not a member of this board" },
          { status: 404 },
        );
      if (error.message === "CANNOT_BAN_OWNER")
        return NextResponse.json(
          { error: "Cannot ban the owner" },
          { status: 403 },
        );
      if (error.message === "INSUFFICIENT_PERMISSIONS")
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 },
        );
    }

    console.error("[BAN_MEMBER]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
