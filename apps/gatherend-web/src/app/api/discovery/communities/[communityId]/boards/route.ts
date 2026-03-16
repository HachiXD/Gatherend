import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { Languages, Prisma } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import {
  loadSerializedUploadedAssetMap,
  serializeUploadedAsset,
} from "@/lib/uploaded-assets";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// NO cachear - el feed cambia constantemente (nuevos boards, refreshes, slots)
export const dynamic = "force-dynamic";
export const revalidate = 0;

// --- CONSTANTES ---
const TAU_HOURS = 1.0; // Constante de decaimiento exponencial (1 hora = caída rápida)
const MAX_AGE_HOURS = 48.0; // Máxima edad para mostrar en feed (48 horas)
const PAGE_SIZE = 3; // TODO: cambiar a 20 en producción

export async function GET(
  req: Request,
  { params }: { params: Promise<{ communityId: string }> },
) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const { communityId } = await params;
    const { searchParams } = new URL(req.url);

    // Validate UUID
    if (!communityId || !UUID_REGEX.test(communityId)) {
      return NextResponse.json(
        { error: "Invalid community ID" },
        { status: 400 },
      );
    }

    // --- PARÁMETROS ---
    // Cursor compuesto: "timestamp|score_id"
    // - timestamp: momento fijo para calcular scores (estabiliza la paginación)
    // - score: el score del último item
    // - id: UUID del último item (desempate)
    const cursorParam = searchParams.get("cursor");
    const limitParam = parseInt(
      searchParams.get("limit") || String(PAGE_SIZE),
      10,
    );
    const limit = Math.min(
      Number.isNaN(limitParam) ? PAGE_SIZE : limitParam,
      50,
    );
    const isFirstPage = !cursorParam;

    // Timestamp fijo para calcular scores - se genera en página 1 y se pasa en el cursor
    // Esto evita que los scores cambien entre requests (el problema era NOW() cambiando)
    let queryTimestamp: Date;
    let cursorScore: number | null = null;
    let cursorId: string | null = null;

    if (cursorParam) {
      // Security: Validate cursor length to prevent DoS
      if (cursorParam.length > 200) {
        return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
      }

      // Formato: "timestamp|score_id" (ej: "2026-01-28T10:00:00.000Z|0.85_uuid-here")
      const [timestampStr, scoreIdPart] = cursorParam.split("|");

      if (timestampStr && scoreIdPart) {
        const parsedTimestamp = new Date(timestampStr);
        const now = Date.now();
        const maxAgeMs = MAX_AGE_HOURS * 60 * 60 * 1000 * 2; // Allow 2x window for safety

        // Security: Validate timestamp is within reasonable bounds
        // Reject timestamps too old (could manipulate decay scores) or in the future
        if (
          !isNaN(parsedTimestamp.getTime()) &&
          parsedTimestamp.getTime() >= now - maxAgeMs &&
          parsedTimestamp.getTime() <= now + 60000 // Allow 1 minute clock drift
        ) {
          queryTimestamp = parsedTimestamp;
        } else {
          // Timestamp out of bounds - reset to now to prevent score manipulation
          queryTimestamp = new Date();
        }

        const separatorIndex = scoreIdPart.indexOf("_");
        if (separatorIndex > 0) {
          const scoreStr = scoreIdPart.slice(0, separatorIndex);
          const id = scoreIdPart.slice(separatorIndex + 1);
          const score = parseFloat(scoreStr);

          // Security: Reject Infinity, -Infinity, NaN, and unreasonable scores
          if (
            Number.isFinite(score) &&
            score >= 0 &&
            score <= 2 &&
            UUID_REGEX.test(id)
          ) {
            cursorScore = score;
            cursorId = id;
          }
        }
      } else {
        queryTimestamp = new Date(); // Fallback
      }
    } else {
      // Primera página: generar timestamp fresco
      queryTimestamp = new Date();
    }

    // Punto de inicio del filtro (máxima edad)
    const windowStart = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000);

    // --- TIPO DE RESPUESTA ---
    interface BoardRow {
      id: string;
      name: string;
      description: string | null;
      imageAssetId: string | null;
      size: number;
      languages: Languages[];
      refreshedAt: Date;
      occupied_count: number;
      final_score: number;
    }

    // --- COMMUNITY METADATA (solo primera página) ---
    // Incluye info de la comunidad + conteo real-time de boards activos
    interface CommunityMetadata {
      id: string;
      name: string;
      imageAsset: ReturnType<typeof serializeUploadedAsset>;
      memberCount: number;
      activeBoardsCount: number;
    }

    let communityMetadata: CommunityMetadata | null = null;
    let communityImageAssetId: string | null = null;

    if (isFirstPage) {
      // Query para obtener metadata de comunidad + conteo real-time de boards activos
      interface CommunityRow {
        id: string;
        name: string;
        imageAssetId: string | null;
        memberCount: number;
        active_boards_count: bigint;
      }

      const communityResult = await db.$queryRaw<CommunityRow[]>`
        SELECT 
          c.id,
          c.name,
          c."imageAssetId",
          -- Real-time unique members across all boards in the community.
          -- We don't rely on the materialized Community.memberCount here because
          -- it can be stale when cron is not running (dev) or between cron ticks.
          COALESCE((
            SELECT COUNT(DISTINCT m."profileId")
            FROM "Board" b
            JOIN "Member" m ON m."boardId" = b.id
            WHERE b."communityId" = c.id
          ), 0)::INTEGER as "memberCount",
          (
            SELECT COUNT(DISTINCT b.id)
            FROM "Board" b
            WHERE b."communityId" = c.id
              AND (b."createdAt" >= ${windowStart} OR b."refreshedAt" >= ${windowStart})
              AND EXISTS (
                SELECT 1 FROM "Slot" s
                WHERE s."boardId" = b.id
                  AND s.mode = 'BY_DISCOVERY'
                  AND s."memberId" IS NULL
              )
          ) as active_boards_count
        FROM "Community" c
        WHERE c.id = ${communityId}
      `;

      if (communityResult.length === 0) {
        return NextResponse.json(
          { error: "Community not found" },
          { status: 404 },
        );
      }

      const community = communityResult[0];
      communityImageAssetId = community.imageAssetId;
      communityMetadata = {
        id: community.id,
        name: community.name,
        imageAsset: null,
        memberCount: community.memberCount,
        activeBoardsCount: Number(community.active_boards_count),
      };
    }

    // --- QUERY SEGURA CON TAGGED TEMPLATE LITERALS ---
    // Filtro de usuario baneado
    const profileFilter = profile
      ? Prisma.sql`
          AND NOT EXISTS (
            SELECT 1 FROM "BoardBan" ban
            WHERE ban."boardId" = b.id AND ban."profileId" = ${profile.id}
          )
        `
      : Prisma.empty;

    // Keyset pagination: buscar boards con score MENOR que el cursor,
    // o mismo score pero ID mayor (para desempate consistente)
    // IMPORTANTE: El score se calcula con queryTimestamp fijo, no NOW()
    const cursorFilter =
      cursorScore !== null && cursorId !== null
        ? Prisma.sql`
          AND (
            scored.final_score < ${cursorScore}
            OR (scored.final_score = ${cursorScore} AND b.id > ${cursorId})
          )
        `
        : Prisma.empty;

    // Query principal con filtro por communityId
    // - Algoritmo de ranking:
    //   * recency = EXP(-age_hours / TAU) → decaimiento exponencial agresivo
    //   * fill_ratio = slots_ocupados / slots_totales (solo BY_DISCOVERY)
    //   * final_score = recency * (0.6 + 0.4 * fill_ratio)
    //
    // IMPORTANTE: Usamos queryTimestamp (fijo) en lugar de NOW() para que
    // los scores sean estables durante toda la sesión de paginación.
    const boards = await db.$queryRaw<BoardRow[]>`
      WITH 
        -- Contar slots de discovery (para el algoritmo de ranking)
        discovery_slots AS (
          SELECT "boardId", 
                 count(*)::float AS total_discovery,
                 count(*) FILTER (WHERE "memberId" IS NOT NULL)::float AS occupied_discovery
          FROM "Slot"
          WHERE "mode" = 'BY_DISCOVERY'
          GROUP BY "boardId"
        ),
        -- Contar TODOS los slots ocupados (para el display de members totales)
        all_slots AS (
          SELECT "boardId",
                 count(*) FILTER (WHERE "memberId" IS NOT NULL)::int AS total_members
          FROM "Slot"
          GROUP BY "boardId"
        ),
        -- Pre-calcular score para cada board
        -- USA queryTimestamp FIJO en lugar de NOW() para estabilidad en paginación
        scored AS (
          SELECT 
            b.id AS board_id,
            b."refreshedAt",
            (
              EXP(- EXTRACT(EPOCH FROM (${queryTimestamp}::timestamptz - b."refreshedAt")) / 3600.0 / ${TAU_HOURS})
              * (0.6 + 0.4 * COALESCE(ds.occupied_discovery / NULLIF(ds.total_discovery, 0), 0))
            ) AS final_score
          FROM "Board" b
          LEFT JOIN discovery_slots ds ON ds."boardId" = b.id
          WHERE b."communityId" = ${communityId}
            AND (b."createdAt" >= ${windowStart} OR b."refreshedAt" >= ${windowStart})
            AND EXISTS (
              SELECT 1 FROM "Slot" s
              WHERE s."boardId" = b.id 
                AND s.mode = 'BY_DISCOVERY' 
                AND s."memberId" IS NULL
            )
        )
      SELECT
        b.id,
        b.name,
        b.description,
        b."imageAssetId",
        b.size,
        b.languages,
        b."refreshedAt",
        COALESCE(als.total_members, 0) AS occupied_count,
        scored.final_score
      FROM "Board" b
      INNER JOIN scored ON scored.board_id = b.id
      LEFT JOIN all_slots als ON als."boardId" = b.id
      WHERE TRUE
        ${profileFilter}
        ${cursorFilter}
      ORDER BY scored.final_score DESC, b.id ASC
      LIMIT ${limit + 1}
    `;

    // --- Mapeo a la respuesta final con paginación ---
    const hasMore = boards.length > limit;
    const items = hasMore ? boards.slice(0, limit) : boards;

    const assetMap = await loadSerializedUploadedAssetMap([
      communityImageAssetId,
      ...items.map((item) => item.imageAssetId),
    ]);

    if (communityMetadata) {
      communityMetadata.imageAsset = communityImageAssetId
        ? (assetMap.get(communityImageAssetId) ?? null)
        : null;
    }

    const result = items.map((r: BoardRow) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      imageAsset: r.imageAssetId ? (assetMap.get(r.imageAssetId) ?? null) : null,
      size: r.size,
      occupiedSlots: r.occupied_count,
      freeSlots: r.size - r.occupied_count,
      languages: r.languages,
      score: r.final_score,
    }));

    // Cursor compuesto: "timestamp|score_id" para keyset pagination con scores estables
    // El timestamp se fija en la primera página y se pasa en todas las siguientes
    const lastItem = items.length > 0 ? items[items.length - 1] : null;
    const nextCursor =
      hasMore && lastItem
        ? `${queryTimestamp.toISOString()}|${lastItem.final_score}_${lastItem.id}`
        : null;

    return NextResponse.json({
      items: result,
      nextCursor,
      hasMore,
      // Solo incluir metadata de comunidad en primera página
      ...(communityMetadata && { community: communityMetadata }),
    });
  } catch (error) {
    console.error("[DISCOVERY_COMMUNITY_BOARDS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
