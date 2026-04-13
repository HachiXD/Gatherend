// apps\gatherend-web\src\app\(invite)\(routes)\invite\[inviteCode]\page.tsx

import { InviteStatus } from "@/components/invite/invite-status";
import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { expressMemberCache } from "@/lib/redis";
import { redirect } from "next/navigation";
import { MemberRole } from "@prisma/client";
interface InviteCodePageProps {
  params: Promise<{
    inviteCode: string;
  }>;
}

// Helper para notificar a los miembros existentes via socket
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
      avatarAsset: import("@/types/uploaded-assets").ClientUploadedAsset | null;
      usernameColor: unknown;
      profileTags: string[];
      badge: string | null;
      badgeSticker: { id: string; asset: import("@/types/uploaded-assets").ClientUploadedAsset | null } | null;
      usernameFormat: unknown;
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
    // No bloquear si falla la notificación
    console.error("[NOTIFY_MEMBER_JOINED]", error);
  }
}

const InviteCodePage = async ({ params }: InviteCodePageProps) => {
  const profile = await currentProfile();
  const { inviteCode } = await params;

  if (!profile) {
    return redirect("/sign-in");
  }

  // Check if user is banned from the platform
  if (profile.banned) {
    const searchParams = new URLSearchParams();
    if (profile.banReason) {
      searchParams.set("reason", profile.banReason);
    }
    if (profile.bannedAt) {
      searchParams.set("bannedAt", profile.bannedAt.toISOString());
    }
    return redirect(`/banned?${searchParams.toString()}`);
  }

  if (!inviteCode) {
    return redirect("/");
  }

  // 1. Buscar board
  const board = await db.board.findFirst({
    where: { inviteCode },
  });

  // Invite inválido o board no existe
  if (!board) {
    return <InviteStatus status="invalid" />;
  }

  // Invitaciones desactivadas
  if (!board.inviteEnabled) {
    return <InviteStatus status="disabled" boardName={board.name} />;
  }

  const boardId = board.id;

  // Está baneado
  const banned = await db.boardBan.findFirst({
    where: {
      boardId,
      profileId: profile.id,
    },
  });

  if (banned) {
    return <InviteStatus status="banned" boardName={board.name} />;
  }

  // Ya es miembro
  const existingMember = await db.member.findFirst({
    where: {
      boardId,
      profileId: profile.id,
    },
  });

  if (existingMember) {
    return redirect(`/boards/${boardId}/rules`);
  }

  // --- LÓGICA DE UNIÓN ---

  try {
    // 2. Transacción atómica
    const { newMember } = await db.$transaction(async (tx) => {
      // Verificar ban dentro de la transacción (TOCTOU)
      const banned = await tx.boardBan.findFirst({
        where: { boardId, profileId: profile.id },
        select: { id: true },
      });
      if (banned) throw new Error("BANNED");

      const newMember = await tx.member.create({
        data: {
          boardId,
          profileId: profile.id,
          role: MemberRole.GUEST,
        },
      });

      return {
        newMember,
      };
    });

    // Notificar a los miembros existentes que alguien se unió
    // (fire-and-forget, no bloquea el redirect)
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
      },
    });

    // ÉXITO: Redirigir directamente al board
  } catch (error) {
    console.error("[INVITE_JOIN_ERROR]", error);
    // Si falló la transacción (ej. alguien tomó el slot milisegundos antes)
    return <InviteStatus status="invalid" />;
  }
  return redirect(`/boards/${boardId}/rules`);
};

export default InviteCodePage;
