import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { MemberRole } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      if (member.role === MemberRole.OWNER) {
        throw new Error("OWNER_CANNOT_LEAVE");
      }

      // 3. Encontrar el slot del usuario
      const userSlot = await tx.slot.findFirst({
        where: {
          boardId,
          memberId: member.id,
        },
      });

      if (!userSlot) {
        console.error(
          `[LEAVE] Inconsistent state: Member ${member.id} has no slot in board ${boardId}`,
        );
        throw new Error("INTERNAL_ERROR");
      }

      // 4. Liberar el slot (preservar el modo original)
      await tx.slot.update({
        where: { id: userSlot.id },
        data: { memberId: null },
      });

      // 5. Borrar el member
      await tx.member.delete({
        where: { id: member.id },
      });
    });

    // Notificar a los miembros restantes (fire-and-forget)
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
      if (error.message === "INTERNAL_ERROR")
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
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
