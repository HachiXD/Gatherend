// apps\gatherend-web\src\app\(invite)\(routes)\invite\[inviteCode]\page.tsx

import { InviteStatus } from "@/components/invite/invite-status";
import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { expressMemberCache } from "@/lib/redis";
import { serializeProfileSummary } from "@/lib/uploaded-assets";
import { redirect } from "next/navigation";
import { ChannelType, MemberRole, SlotMode } from "@prisma/client"; // Importar tipos necesarios
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

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
  newMemberProfile: {
    id: string;
    username: string;
    avatarAsset: ClientUploadedAsset | null;
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
          profile: newMemberProfile,
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

async function notifyWelcomeMessage(channelId: string, message: object) {
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
        room: `channel:${channelId}`,
        event: `chat:${channelId}:messages`,
        data: message,
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (error) {
    console.error("[NOTIFY_WELCOME_MESSAGE]", error);
  }
}

function serializeWelcomeMessagePayload(message: any) {
  return {
    ...message,
    messageSender: message.messageSender
      ? serializeProfileSummary(message.messageSender)
      : null,
    member: message.member
      ? {
          ...message.member,
          profile: serializeProfileSummary(
            message.member.profile ?? message.messageSender ?? null,
          ),
        }
      : null,
  };
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

  // 1. Buscar board y sus slots en una sola consulta
  const board = await db.board.findFirst({
    where: { inviteCode },
    include: {
      slots: {
        where: { memberId: null }, // Traemos solo slots libres para optimizar
      },
    },
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
    const targetChannel =
      (await db.channel.findFirst({
        where: { boardId, type: ChannelType.MAIN },
        select: { id: true },
      })) ??
      (await db.channel.findFirst({
        where: { boardId },
        orderBy: { position: "asc" },
        select: { id: true },
      }));

    return redirect(
      targetChannel
        ? `/boards/${boardId}/rooms/${targetChannel.id}`
        : `/boards/${boardId}`,
    );
  }

  // --- LÓGICA DE UNIÓN (Movida desde la API) ---

  // 2. Buscar un slot disponible por INVITACIÓN
  const freeSlot = board.slots.find((s) => s.mode === SlotMode.BY_INVITATION);

  // Si no hay slots, podrías mostrar un estado de "Lleno"
  if (!freeSlot) {
    // Puedes crear un componente <InviteStatus status="full" /> o redirigir
    return <InviteStatus status="invalid" />; // O manejar status "full"
  }

  let targetChannelId: string | null = null;

  try {
    // 3. Transacción atómica (igual que tenías en la API)
    const { targetChannelId: joinedTargetChannelId, welcomeMessage } =
      await db.$transaction(
      async (tx) => {
      // Re-verificar slot dentro de la transacción para evitar condiciones de carrera
      const slotCheck = await tx.slot.findUnique({
        where: { id: freeSlot.id },
      });

      if (
        !slotCheck ||
        slotCheck.memberId !== null ||
        slotCheck.mode !== SlotMode.BY_INVITATION
      ) {
        throw new Error("Slot was just taken");
      }

      // Crear Member
      const newMember = await tx.member.create({
        data: {
          boardId,
          profileId: profile.id,
          role: MemberRole.GUEST,
        },
      });

      // Ocupar slot
      await tx.slot.update({
        where: { id: freeSlot.id },
        data: {
          memberId: newMember.id,
        },
      });

      const targetChannel =
        (await tx.channel.findFirst({
          where: { boardId, type: ChannelType.MAIN },
          select: { id: true },
        })) ??
        (await tx.channel.findFirst({
          where: { boardId },
          orderBy: { position: "asc" },
          select: { id: true },
        }));

      let welcomeMessage = null;
      if (targetChannel) {
        welcomeMessage = await tx.message.create({
          data: {
            channelId: targetChannel.id,
            type: "WELCOME",
            content: "",
            memberId: newMember.id,
            messageSenderId: profile.id,
          },
          include: {
            member: {
              include: {
                profile: {
                  include: {
                    avatarAsset: true,
                    badgeSticker: {
                      include: {
                        asset: true,
                      },
                    },
                  },
                },
              },
            },
            messageSender: {
              include: {
                avatarAsset: true,
                badgeSticker: {
                  include: {
                    asset: true,
                  },
                },
              },
            },
          },
        });
      }

      return {
        targetChannelId: targetChannel?.id ?? null,
        welcomeMessage,
      };
      },
    );

    // Notificar a los miembros existentes que alguien se unió
    // (fire-and-forget, no bloquea el redirect)
    targetChannelId = joinedTargetChannelId;
    await expressMemberCache.invalidate(boardId, profile.id);
    expressMemberCache.invalidateBoardIds(profile.id);

    notifyBoardMembership(profile.id, boardId, "join");
    notifyMemberJoined(boardId, {
      id: profile.id,
      username: profile.username,
      avatarAsset: profile.avatarAsset,
    });

    if (targetChannelId && welcomeMessage) {
      notifyWelcomeMessage(
        targetChannelId,
        serializeWelcomeMessagePayload(welcomeMessage),
      );
    }

    // ÉXITO: Redirigir directamente al board
  } catch (error) {
    console.error("[INVITE_JOIN_ERROR]", error);
    // Si falló la transacción (ej. alguien tomó el slot milisegundos antes)
    return <InviteStatus status="invalid" />;
  }
  return redirect(
    targetChannelId
      ? `/boards/${boardId}/rooms/${targetChannelId}`
      : `/boards/${boardId}`,
  );
};

export default InviteCodePage;
