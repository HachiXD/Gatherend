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

// Helper para notificar a los miembros restantes y al usuario kickeado
async function notifyMemberKicked(boardId: string, profileId: string) {
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
            reason: "kicked",
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
          event: "board:kicked",
          data: {
            boardId,
            kickedProfileId: profileId,
            timestamp,
          },
        }),
        signal: AbortSignal.timeout(3000),
      }),
    ]);
  } catch (error) {
    console.error("[NOTIFY_MEMBER_KICKED]", error);
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

    let targetProfileId: unknown;
    try {
      const body = await req.json();
      targetProfileId = body.targetProfileId;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const boardId = params.boardId;

    if (!boardId || typeof targetProfileId !== "string" || !targetProfileId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Validate UUIDs
    if (!UUID_REGEX.test(boardId) || !UUID_REGEX.test(targetProfileId)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    // Ejecutar toda la lógica dentro de una transacción para consistencia
    const result = await db.$transaction(async (tx) => {
      // 1. Buscar al "actor" (el que está haciendo kick)
      const actor = await tx.member.findFirst({
        where: { boardId, profileId: profile.id },
        select: { id: true, role: true },
      });

      if (!actor) {
        throw new Error("NOT_A_MEMBER");
      }

      // Solo OWNER, ADMIN y MOD pueden kickear
      if (
        actor.role !== MemberRole.OWNER &&
        actor.role !== MemberRole.ADMIN &&
        actor.role !== MemberRole.MODERATOR
      ) {
        throw new Error("FORBIDDEN");
      }

      // 2. Buscar al target
      const target = await tx.member.findFirst({
        where: { boardId, profileId: targetProfileId },
        select: { id: true, role: true, profileId: true },
      });

      if (!target) {
        throw new Error("TARGET_NOT_FOUND");
      }

      // 3. Reglas de jerarquía
      if (actor.id === target.id) {
        throw new Error("CANNOT_KICK_SELF");
      }

      if (target.role === MemberRole.OWNER) {
        throw new Error("CANNOT_KICK_OWNER");
      }

      // Un ADMIN no puede kickear a otro ADMIN
      if (actor.role === MemberRole.ADMIN && target.role === MemberRole.ADMIN) {
        throw new Error("ADMIN_CANNOT_KICK_ADMIN");
      }

      // Un MOD no puede kickear a ADMIN o MOD
      if (
        actor.role === MemberRole.MODERATOR &&
        (target.role === MemberRole.ADMIN ||
          target.role === MemberRole.MODERATOR)
      ) {
        throw new Error("INSUFFICIENT_PERMISSIONS");
      }

      // 4. Eliminar membresías de canales y member
      await tx.channelMember.deleteMany({
        where: {
          profileId: targetProfileId,
          channel: { boardId },
        },
      });

      await tx.member.delete({
        where: { id: target.id },
      });

      return { targetProfileId: target.profileId };
    });

    await expressMemberCache.invalidate(boardId, result.targetProfileId);
    expressMemberCache.invalidateBoardIds(result.targetProfileId);

    // Notificar a los miembros restantes (fire-and-forget)
    notifyBoardMembership(result.targetProfileId, boardId, "leave");
    notifyMemberKicked(boardId, targetProfileId);

    return NextResponse.json({
      success: true,
      kickedProfileId: targetProfileId,
    });
  } catch (error) {
    // Manejar errores personalizados lanzados desde la transacción
    if (error instanceof Error) {
      if (error.message === "NOT_A_MEMBER")
        return NextResponse.json({ error: "Not a member" }, { status: 403 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (error.message === "TARGET_NOT_FOUND")
        return NextResponse.json(
          { error: "Target not found" },
          { status: 404 },
        );
      if (error.message === "CANNOT_KICK_SELF")
        return NextResponse.json(
          { error: "You cannot kick yourself" },
          { status: 400 },
        );
      if (error.message === "CANNOT_KICK_OWNER")
        return NextResponse.json(
          { error: "Cannot kick the owner" },
          { status: 403 },
        );
      if (error.message === "ADMIN_CANNOT_KICK_ADMIN")
        return NextResponse.json(
          { error: "Admins cannot kick other admins" },
          { status: 403 },
        );
      if (error.message === "INSUFFICIENT_PERMISSIONS")
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 },
        );
    }

    console.error("[KICK_MEMBER]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
