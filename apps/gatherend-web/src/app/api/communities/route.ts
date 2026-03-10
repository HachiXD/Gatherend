// app/api/communities/route.ts

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { moderateDescription } from "@/lib/text-moderation";
import { Prisma } from "@prisma/client";

// No cachear requests
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_PREFIXES = [
  ...(process.env.NEXT_PUBLIC_DICEBEAR_URL
    ? [process.env.NEXT_PUBLIC_DICEBEAR_URL]
    : []),
  ...(process.env.NEXT_PUBLIC_CDN_URL ? [process.env.NEXT_PUBLIC_CDN_URL] : []),
];

const MAX_NAME_LENGTH = 50;
const MIN_NAME_LENGTH = 2;

function isAllowedUrl(url: string) {
  return ALLOWED_PREFIXES.some((prefix) => url.startsWith(prefix));
}

// GET - Listar comunidades disponibles
// Soporta: ?search=texto&limit=10
// Sin search: devuelve top N comunidades por rankingScore (del cron)
// Con search: busca por nombre y devuelve top N matches ordenados por rankingScore
// Usa el mismo ranking pre-calculado que /api/discovery/communities para eficiencia

export async function GET(req: Request) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const _profile = auth.profile;

    const { searchParams } = new URL(req.url);
    const rawSearch = searchParams.get("search")?.trim() || "";
    const search = rawSearch.slice(0, 100); // Limit search length
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50); // Max 50

    // Construir where clause según si hay búsqueda o no
    const whereClause = search
      ? {
          name: {
            contains: search,
            mode: "insensitive" as const,
          },
        }
      : {};

    // Usar rankingScore pre-calculado por el cron (O(1) query con índice)
    // En vez de calcular memberCount en runtime (O(N×M×K))
    const communities = await db.community.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        imageUrl: true,
        memberCount: true,
        feedBoardCount: true, // Campo correcto del schema
        rankingScore: true,
      },
      orderBy: [
        { rankingScore: "desc" }, // Usa índice @@index([rankingScore(sort: Desc)])
        { name: "asc" }, // Desempate
      ],
      take: limit, // LIMIT en DB, no en JS
    });

    // Mapear a formato esperado (sin rankingScore expuesto)
    const result = communities.map((c) => ({
      id: c.id,
      name: c.name,
      imageUrl: c.imageUrl,
      memberCount: c.memberCount,
      boardCount: c.feedBoardCount, // Mapear al nombre que espera el frontend
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("[COMMUNITIES_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// POST - Crear nueva comunidad

export async function POST(req: Request) {
  try {
    // Rate limiting - usar mismo rate limit que boardCreate
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.boardCreate);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    // Parse body with try-catch
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { name, imageUrl } = body;

    // Validar nombre - tipo
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Name is required and must be a string" },
        { status: 400 },
      );
    }

    const trimmedName = name.trim();

    // Validar nombre - longitud
    if (trimmedName.length < MIN_NAME_LENGTH) {
      return NextResponse.json(
        { error: `Name must be at least ${MIN_NAME_LENGTH} characters` },
        { status: 400 },
      );
    }

    if (trimmedName.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `Name cannot exceed ${MAX_NAME_LENGTH} characters` },
        { status: 400 },
      );
    }

    // Moderar nombre de la comunidad
    const nameModeration = moderateDescription(trimmedName);
    if (!nameModeration.allowed) {
      return NextResponse.json(
        {
          error: "MODERATION_BLOCKED",
          message: "Community name contains prohibited content",
          reason: nameModeration.reason,
        },
        { status: 400 },
      );
    }

    // Validar y normalizar imagen (opcional)
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
    }

    // Crear la comunidad y el helper en transacción
    const community = await db.$transaction(async (tx) => {
      const newCommunity = await tx.community.create({
        data: {
          name: trimmedName,
          imageUrl: finalImageUrl,
        },
        select: {
          id: true,
          name: true,
          imageUrl: true,
        },
      });

      // Crear el helper (creador de la comunidad)
      await tx.communityHelper.create({
        data: {
          communityId: newCommunity.id,
          profileId: profile.id,
        },
      });

      return newCommunity;
    });

    return NextResponse.json(community);
  } catch (error) {
    // Handle unique constraint violation (duplicate name)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A community with this name already exists" },
        { status: 409 },
      );
    }

    console.error("[COMMUNITIES_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
