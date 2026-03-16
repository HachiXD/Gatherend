import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { MemberRole, Prisma, SlotMode } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Helper function to notify the members about the Welcome Message
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

    // 1. TRAER BOARD (solo slots libres)
    const board = await db.board.findUnique({
      where: { id: boardId },
      select: {
        id: true,
        inviteCode: true,
        inviteEnabled: true,
        slots: {
          where: {
            memberId: null,
          },
        },
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
      const hasPublicSlots = board.slots.some(
        (s) => s.mode === SlotMode.BY_DISCOVERY,
      );

      if (!hasPublicSlots) {
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
      return NextResponse.json({
        alreadyMember: true,
        redirectUrl: `/boards/${boardId}`,
      });
    }

    // 4. SLOT ADECUADO SEGÚN ORIGEN
    const targetMode =
      source === "invitation" ? SlotMode.BY_INVITATION : SlotMode.BY_DISCOVERY;

    // 5. JOIN ATÓMICO con FOR UPDATE SKIP LOCKED (evita race conditions)
    const {
      newMember: member,
      welcomeMessage,
      firstChannelId,
    } = await db.$transaction(async (tx) => {
      // Verificar ban dentro de la transacción para evitar TOCTOU
      const banned = await tx.boardBan.findFirst({
        where: { boardId, profileId: profile.id },
        select: { id: true },
      });

      if (banned) {
        throw new Error("BANNED");
      }

      const availableSlots = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM "Slot"
        WHERE "boardId" = ${boardId}
          AND "mode" = ${targetMode}::"SlotMode"
          AND "memberId" IS NULL
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `;

      if (availableSlots.length === 0) {
        throw new Error("No slots available");
      }

      const slotId = availableSlots[0].id;

      const newMember = await tx.member.create({
        data: {
          boardId,
          profileId: profile.id,
          role: MemberRole.GUEST,
        },
      });

      await tx.slot.update({
        where: { id: slotId },
        data: {
          memberId: newMember.id,
        },
      });

      const firstChannel = await tx.channel.findFirst({
        where: { boardId },
        orderBy: { position: "asc" },
      });

      let welcomeMessage = null;
      if (firstChannel) {
        welcomeMessage = await tx.message.create({
          data: {
            channelId: firstChannel.id,
            type: "WELCOME",
            content: "",
            memberId: newMember.id,
          },
          include: {
            member: {
              include: { profile: true },
            },
          },
        });
      }

      return {
        newMember,
        welcomeMessage,
        firstChannelId: firstChannel?.id ?? null,
      };
    });

    // Notificar a los miembros existentes que alguien se unió
    notifyMemberJoined(boardId, {
      id: profile.id,
      username: profile.username,
      avatarAsset: profile.avatarAsset,
    });

    if (firstChannelId && welcomeMessage) {
      notifyWelcomeMessage(firstChannelId, welcomeMessage);
    }

    // 6. RESPUESTA
    return NextResponse.json({
      success: true,
      memberId: member.id,
      redirectUrl: `/boards/${boardId}`,
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
      if (error.message === "No slots available") {
        return NextResponse.json(
          { error: "No slots available" },
          { status: 409 },
        );
      }
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        { error: "Slot no longer available" },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
