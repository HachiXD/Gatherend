import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { isOwner } from "@/lib/domain";
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

// Helper para notificar a los miembros que alguien dejó el board
async function notifyMemberLeft(boardId: string, profileId: string) {
  try {
    const socketUrl =
      process.env.SOCKET_SERVER_URL || process.env.NEXT_PUBLIC_SOCKET_URL;
    const secret = process.env.INTERNAL_API_SECRET;

    // Skip if socket URL or secret is not configured
    if (!socketUrl || !secret) return;

    await fetch(`${socketUrl}/emit-to-room`, {
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
          timestamp: Date.now(),
        },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (error) {
    console.error("[NOTIFY_MEMBER_LEFT]", error);
  }
}

async function handleLeaveBoard(
  _req: Request,
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

    const boardId = params.boardId;

    // Validate UUID
    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    // Ejecutar toda la lógica dentro de una transacción para consistencia
    await db.$transaction(async (tx) => {
      // 1. Encontrar member del usuario
      const member = await tx.member.findFirst({
        where: {
          boardId,
          profileId: profile.id,
        },
        select: {
          id: true,
          role: true,
        },
      });

      if (!member) {
        throw new Error("NOT_A_MEMBER");
      }

      // 2. El OWNER NO PUEDE abandonar
      if (isOwner(member.role)) {
        throw new Error("OWNER_CANNOT_LEAVE");
      }

      // 3. Eliminar membresías de canales y member
      await tx.channelMember.deleteMany({
        where: {
          profileId: profile.id,
          channel: { boardId },
        },
      });

      await tx.channelReadState.deleteMany({
        where: {
          profileId: profile.id,
          channel: { boardId },
        },
      });

      await tx.mention.deleteMany({
        where: {
          profileId: profile.id,
          message: {
            channel: { boardId },
          },
        },
      });

      await tx.member.delete({
        where: { id: member.id },
      });
    });

    await expressMemberCache.invalidate(boardId, profile.id);
    expressMemberCache.invalidateBoardIds(profile.id);

    // Notificar a los miembros restantes (fire-and-forget)
    notifyBoardMembership(profile.id, boardId, "leave");
    notifyMemberLeft(boardId, profile.id);

    return NextResponse.json({
      success: true,
      redirectUrl: "/",
    });
  } catch (error) {
    // Manejar errores personalizados lanzados desde la transacción
    if (error instanceof Error) {
      if (error.message === "NOT_A_MEMBER")
        return NextResponse.json({ error: "Not a member" }, { status: 403 });
      if (error.message === "OWNER_CANNOT_LEAVE")
        return NextResponse.json(
          { error: "The owner cannot leave the board" },
          { status: 403 },
        );
    }

    console.error("[LEAVE_BOARD]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  return handleLeaveBoard(req, context);
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  return handleLeaveBoard(req, context);
}
