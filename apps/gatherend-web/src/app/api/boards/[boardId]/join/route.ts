import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { MemberRole, Prisma } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { expressMemberCache } from "@/lib/redis";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";
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

async function notifyMemberJoined(
  boardId: string,
  member: {
    id: string;
    role: string;
    profileId: string;
    boardId: string;
    createdAt: string;
    updatedAt: string;
    profile: {
      id: string;
      username: string;
      discriminator: string | null;
      avatarAsset: ClientUploadedAsset | null;
      usernameColor: unknown;
      profileTags: string[];
      badge: string | null;
      badgeSticker: { id: string; asset: ClientUploadedAsset | null } | null;
      usernameFormat: unknown;
      longDescription: string | null;
    };
  },
) {
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
        event: "board:member-joined",
        data: {
          boardId,
          member,
          timestamp: Date.now(),
        },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (error) {
    console.error("[NOTIFY_MEMBER_JOINED]", error);
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.boardJoin);
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

    const { searchParams } = new URL(req.url);
    const source = searchParams.get("source") ?? "invitation";

    if (!["invitation", "discovery"].includes(source)) {
      return NextResponse.json({ error: "Invalid source" }, { status: 400 });
    }

    // 1. TRAER BOARD
    const board = await db.board.findUnique({
      where: { id: boardId },
      select: {
        id: true,
        inviteCode: true,
        inviteEnabled: true,
        isPrivate: true,
      },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    // 2. VALIDACIONES DE ORIGEN
    if (source === "invitation") {
      const inviteCode = searchParams.get("inviteCode");

      if (!inviteCode || board.inviteCode !== inviteCode) {
        return NextResponse.json(
          { error: "Invalid invite code" },
          { status: 403 },
        );
      }

      if (!board.inviteEnabled) {
        return NextResponse.json(
          { error: "Invites disabled" },
          { status: 403 },
        );
      }
    }

    if (source === "discovery") {
      if (board.isPrivate) {
        return NextResponse.json(
          { error: "Not discoverable" },
          { status: 403 },
        );
      }
    }

    // 3. Verificar si ya es miembro (fuera de transacción para early return rápido)
    const existingMember = await db.member.findFirst({
      where: { boardId, profileId: profile.id },
      select: { id: true },
    });

    if (existingMember) {
      const targetChannel = await db.channel.findFirst({
        where: { boardId },
        orderBy: { position: "asc" },
        select: { id: true },
      });

      return NextResponse.json({
        alreadyMember: true,
        targetChannelId: targetChannel?.id ?? null,
        redirectUrl: targetChannel
          ? `/boards/${boardId}/rooms/${targetChannel.id}`
          : `/boards/${boardId}`,
      });
    }

    // 4. JOIN ATÓMICO dentro de transacción
    const { targetChannelId, newMember } = await db.$transaction(async (tx) => {
      // Verificar ban dentro de la transacción para evitar TOCTOU
      const banned = await tx.boardBan.findFirst({
        where: { boardId, profileId: profile.id },
        select: { id: true },
      });

      if (banned) {
        throw new Error("BANNED");
      }

      const newMember = await tx.member.create({
        data: {
          boardId,
          profileId: profile.id,
          role: MemberRole.GUEST,
        },
      });

      const targetChannel = await tx.channel.findFirst({
        where: { boardId },
        orderBy: { position: "asc" },
        select: { id: true },
      });

      return {
        newMember,
        targetChannelId: targetChannel?.id ?? null,
      };
    });

    // Notificar a los miembros existentes que alguien se unió
    await expressMemberCache.invalidate(boardId, profile.id);
    expressMemberCache.invalidateBoardIds(profile.id);

    notifyBoardMembership(profile.id, boardId, "join");
    notifyMemberJoined(boardId, {
      id: newMember.id,
      role: newMember.role,
      profileId: newMember.profileId,
      boardId: newMember.boardId,
      createdAt: newMember.createdAt.toISOString(),
      updatedAt: newMember.updatedAt.toISOString(),
      profile: {
        id: profile.id,
        username: profile.username,
        discriminator: profile.discriminator ?? null,
        avatarAsset: profile.avatarAsset,
        usernameColor: profile.usernameColor,
        profileTags: profile.profileTags,
        badge: profile.badge,
        badgeSticker: profile.badgeSticker,
        usernameFormat: profile.usernameFormat,
        longDescription: profile.longDescription,
      },
    });

    // 5. RESPUESTA
    return NextResponse.json({
      success: true,
      targetChannelId,
      redirectUrl: targetChannelId
        ? `/boards/${boardId}/rooms/${targetChannelId}`
        : `/boards/${boardId}`,
    });
  } catch (error) {
    console.error("[BOARD_JOIN] Error:", error);

    // Manejar errores personalizados lanzados desde la transacción
    if (error instanceof Error) {
      if (error.message === "BANNED") {
        return NextResponse.json(
          { error: "Banned from this board" },
          { status: 403 },
        );
      }
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002: unique constraint — already a member (concurrent requests)
      return NextResponse.json(
        { error: "Already a member" },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
