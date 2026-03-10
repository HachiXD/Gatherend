// app/api/boards/route.ts

import { v4 as uuidv4 } from "uuid";
import { MemberRole, SlotMode, Languages, ChannelType } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { moderateDescription } from "@/lib/text-moderation";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_PREFIXES = [
  // Dicebear avatars (parametrized via env)
  ...(process.env.NEXT_PUBLIC_DICEBEAR_URL
    ? [process.env.NEXT_PUBLIC_DICEBEAR_URL]
    : []),
  // R2 / custom CDN
  ...(process.env.NEXT_PUBLIC_CDN_URL ? [process.env.NEXT_PUBLIC_CDN_URL] : []),
];

// Máximo de asientos (sin contar al creador: 48 + 1 owner = 49 total)
const MAX_SEATS = 48;

function isAllowedUrl(url: string) {
  return ALLOWED_PREFIXES.some((prefix) => url.startsWith(prefix));
}

// No cachear GET requests
export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET - Listar boards del usuario

export async function GET() {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const boards = await db.board.findMany({
      where: {
        members: {
          some: {
            profileId: profile.id,
          },
        },
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        channels: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const boardIds = boards.map((b) => b.id);

    // Fetch MAIN channel id per board (single query) so the client can navigate
    // directly to /rooms/:id without downloading channel types for every channel.
    const mainChannels = await db.channel.findMany({
      where: {
        boardId: { in: boardIds },
        type: ChannelType.MAIN,
      },
      select: {
        boardId: true,
        id: true,
      },
    });

    const mainChannelIdByBoardId = new Map<string, string>();
    for (const ch of mainChannels) {
      if (!mainChannelIdByBoardId.has(ch.boardId)) {
        mainChannelIdByBoardId.set(ch.boardId, ch.id);
      }
    }

    const payload = boards.map((b) => ({
      ...b,
      mainChannelId: mainChannelIdByBoardId.get(b.id) ?? null,
    }));

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[BOARDS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// POST - Crear nuevo board

export async function POST(req: Request) {
  try {
    // Rate limiting para creación de boards
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.boardCreate);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const {
      name,
      description,
      imageUrl,
      publicSeats,
      invitationSeats,
      communityId,
    }: {
      name: string;
      description?: string;
      imageUrl?: string;
      publicSeats: number;
      invitationSeats: number;
      communityId?: string;
    } = body;

    // VALIDACIONES DE CAMPOS BÁSICOS

    // Usar los idiomas del perfil del usuario, no los enviados desde el cliente
    // Esto asegura que los boards creados siempre coincidan con el idioma del usuario
    const languagesNorm: Languages[] =
      profile.languages && profile.languages.length > 0
        ? profile.languages
        : ["EN"];

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Board name is required (min 2 characters)" },
        { status: 400 },
      );
    }

    if (name.trim().length > 50) {
      return NextResponse.json(
        { error: "Board name must be 50 characters or less" },
        { status: 400 },
      );
    }

    if (description && description.length > 300) {
      return NextResponse.json(
        { error: "Description must be 300 characters or less" },
        { status: 400 },
      );
    }

    // MODERACIÓN DE DESCRIPCIÓN

    if (description && description.trim().length > 0) {
      const moderationResult = moderateDescription(description);
      if (!moderationResult.allowed) {
        return NextResponse.json(
          {
            error: "MODERATION_BLOCKED",
            message:
              moderationResult.message ||
              "Description contains prohibited content",
            reason: moderationResult.reason,
          },
          { status: 400 },
        );
      }
    }

    // Moderar también el nombre del board
    const nameModeration = moderateDescription(name);
    if (!nameModeration.allowed) {
      return NextResponse.json(
        {
          error: "MODERATION_BLOCKED",
          message: "Board name contains prohibited content",
          reason: nameModeration.reason,
        },
        { status: 400 },
      );
    }

    // Ya no validamos languages del body, usamos los del perfil directamente

    if (
      typeof publicSeats !== "number" ||
      typeof invitationSeats !== "number" ||
      !Number.isInteger(publicSeats) ||
      !Number.isInteger(invitationSeats)
    ) {
      return NextResponse.json(
        { error: "Seats must be integer numbers" },
        { status: 400 },
      );
    }

    if (publicSeats < 0 || invitationSeats < 0) {
      return NextResponse.json(
        { error: "Seats cannot be negative" },
        { status: 400 },
      );
    }

    // Si hay slots públicos, debe haber mínimo 4 (previene bullying/aislamiento)
    if (publicSeats > 0 && publicSeats < 4) {
      return NextResponse.json(
        { error: "Public seats must be at least 4 or 0" },
        { status: 400 },
      );
    }

    const totalSeats = publicSeats + invitationSeats;

    // totalSeats son los slots configurables (sin el owner)
    // El owner siempre ocupa 1 slot adicional BY_INVITATION
    // size total = totalSeats + 1 (owner)
    // MAX_SEATS = 48 slots configurables → 49 personas máximo

    if (totalSeats > MAX_SEATS) {
      return NextResponse.json(
        { error: `Total seats cannot exceed ${MAX_SEATS}` },
        { status: 400 },
      );
    }

    // VALIDACIÓN DE COMMUNITY ID (requerido si hay seats públicos)

    if (communityId) {
      if (!UUID_REGEX.test(communityId)) {
        return NextResponse.json(
          { error: "Invalid community ID format" },
          { status: 400 },
        );
      }
    }

    if (publicSeats > 0 && !communityId) {
      return NextResponse.json(
        { error: "Community is required when public seats are enabled" },
        { status: 400 },
      );
    }

    // VALIDACIÓN Y NORMALIZACIÓN DE IMAGE URL (OPCIONAL)

    let finalImageUrl: string | null = null;

    if (imageUrl) {
      try {
        // FileUpload returns JSON string: {"url":"...", "type":"...", ...}
        const parsed = JSON.parse(imageUrl);
        if (
          parsed.url &&
          typeof parsed.url === "string" &&
          isAllowedUrl(parsed.url)
        ) {
          finalImageUrl = parsed.url;
        }
      } catch {
        // Caso string simple (URL directa)
        if (typeof imageUrl === "string" && isAllowedUrl(imageUrl)) {
          finalImageUrl = imageUrl;
        }
      }

      // Si se envió imageUrl pero no es válida, error
      if (!finalImageUrl) {
        return NextResponse.json(
          { error: "Invalid image URL" },
          { status: 400 },
        );
      }
    }

    // SIZE = tú + todos los seats

    const size = totalSeats + 1; // 1 = creador

    // TRANSACCIÓN: crear board, owner, canal, slots

    const board = await db.$transaction(async (tx) => {
      // 1. Crear board + miembro owner + canal "general"
      const newBoard = await tx.board.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          imageUrl: finalImageUrl, // puede ser null
          size,
          languages: languagesNorm,
          profileId: profile.id,
          inviteCode: uuidv4(),
          refreshedAt: new Date(),
          communityId: communityId || null,

          members: {
            create: {
              profileId: profile.id,
              role: MemberRole.OWNER,
            },
          },

          channels: {
            createMany: {
              data: [
                {
                  name: "gathern",
                  type: ChannelType.MAIN,
                  profileId: profile.id,
                },
                {
                  name: "Text room",
                  type: ChannelType.TEXT,
                  profileId: profile.id,
                },
                {
                  name: "VR",
                  type: ChannelType.VOICE,
                  profileId: profile.id,
                },
              ],
            },
          },
        },
        include: {
          members: true,
          channels: true,
        },
      });

      // Buscar owner explícitamente por rol (no por posición en array)
      const ownerMember = newBoard.members.find(
        (m) => m.role === MemberRole.OWNER,
      );
      if (!ownerMember) {
        throw new Error("Owner member not created - transaction will rollback");
      }

      // 2. Construir slots:
      // - 1 slot ocupado por el owner (BY_INVITATION)
      // - publicSeats slots con mode BY_DISCOVERY
      // - invitationSeats slots con mode BY_INVITATION

      const slotsData: {
        boardId: string;
        mode: SlotMode;
        memberId: string | null;
      }[] = [];

      // Slot del owner
      slotsData.push({
        boardId: newBoard.id,
        mode: SlotMode.BY_INVITATION,
        memberId: ownerMember.id,
      });

      // Discovery seats
      for (let i = 0; i < publicSeats; i++) {
        slotsData.push({
          boardId: newBoard.id,
          mode: SlotMode.BY_DISCOVERY,
          memberId: null,
        });
      }

      // Invitation seats
      for (let i = 0; i < invitationSeats; i++) {
        slotsData.push({
          boardId: newBoard.id,
          mode: SlotMode.BY_INVITATION,
          memberId: null,
        });
      }

      await tx.slot.createMany({ data: slotsData });

      // 3. Retornar board completo ya con relaciones
      return tx.board.findUnique({
        where: { id: newBoard.id },
        include: {
          slots: true,
          members: true,
          channels: true,
        },
      });
    });

    // Invalidar cache de la lista de boards
    revalidatePath("/boards");

    // Emitir evento de discovery si el board tiene communityId
    if (board?.communityId) {
      const socketUrl = `${process.env.SOCKET_SERVER_URL}/emit-to-room`;
      const roomName = `discovery:community:${board.communityId}`;

      // Fire-and-forget - no bloquear la respuesta
      fetch(socketUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": process.env.INTERNAL_API_SECRET || "",
        },
        body: JSON.stringify({
          room: roomName,
          event: "discovery:board-created",
          data: { communityId: board.communityId, boardId: board.id },
        }),
        signal: AbortSignal.timeout(3000),
      }).catch((err) => {
        console.error("Error emitiendo discovery:board-created:", err);
      });
    }

    return NextResponse.json(board);
  } catch (error) {
    console.error("[BOARD_CREATE_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
