import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { communityFeedCache } from "@/lib/redis";
import { logger } from "@/lib/logger";
import {
  loadSerializedUploadedAssetMap,
  serializeUploadedAsset,
} from "@/lib/uploaded-assets";

// NO cachear a nivel de Next.js - usamos Redis para cache
export const dynamic = "force-dynamic";
export const revalidate = 0;

// --- CONSTANTES ---
const PAGE_SIZE = 3; // TODO: cambiar a 20 en producción
// Floats may not round-trip bit-perfect through cursor strings; use an epsilon
// so keyset pagination doesn't drop rows when many communities share the same score.
const RANKING_SCORE_EPSILON = 1e-9;

// --- TIPO DE RESPUESTA ---
interface CommunityResult {
  id: string;
  name: string;
  description: null;
  imageAsset: ReturnType<typeof serializeUploadedAsset>;
  memberCount: number;
  boardCount: number;
  recentPostCount7d: number;
}

interface PageResponse {
  items: CommunityResult[];
  nextCursor: string | null;
  hasMore: boolean;
}

export async function GET(req: Request) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;

    const { searchParams } = new URL(req.url);

    // --- PARÁMETROS ---
    // Cursor para keyset pagination: "rankingScore_id" (ej: "5.23_uuid-here")
    const cursorParam = searchParams.get("cursor");
    const limitParam = parseInt(
      searchParams.get("limit") || String(PAGE_SIZE),
      10,
    );
    const limit = Math.min(
      Number.isNaN(limitParam) ? PAGE_SIZE : limitParam,
      50,
    );

    // Validar y parsear cursor compuesto "rankingScore_id"
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    let cursorScore: number | null = null;
    let cursorId: string | null = null;
    let cursorIsValid = false;

    if (cursorParam) {
      // Security: Validate cursor length to prevent DoS
      if (cursorParam.length > 100) {
        return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
      }

      const separatorIndex = cursorParam.indexOf("_");
      if (separatorIndex > 0) {
        const scoreStr = cursorParam.slice(0, separatorIndex);
        const id = cursorParam.slice(separatorIndex + 1);
        const score = parseFloat(scoreStr);

        // Security: Reject Infinity, -Infinity, NaN, and extremely large/small scores
        if (!Number.isFinite(score) || score < -1e10 || score > 1e10) {
          return NextResponse.json(
            { error: "Invalid cursor score" },
            { status: 400 },
          );
        }

        if (uuidRegex.test(id)) {
          cursorScore = score;
          cursorId = id;
          cursorIsValid = true;
        }
      }
    }

    // Calculate page number for caching (only pages 1-10 are cached)
    // Page 1 = no cursor, Page 2+ = has cursor
    // We can only cache page 1 reliably since cursor changes
    const isFirstPage = !cursorParam;
    const pageNumber = isFirstPage ? 1 : null; // Only cache first page for simplicity

    // Try to get from cache (only first page)
    if (pageNumber === 1) {
      const cacheStart = Date.now();
      const cached = await communityFeedCache.getPage<PageResponse>(1);
      const cacheLatency = Date.now() - cacheStart;

      if (cached) {
        // Telemetry: Log slow cache hits (> 50ms indicates Redis issues)
        if (cacheLatency > 50) {
          logger.warn("[DISCOVERY_CACHE] Slow cache hit", {
            latencyMs: cacheLatency,
          });
        }
        return NextResponse.json(cached);
      } else {
        // Telemetry: Log cache miss for monitoring cache effectiveness
        logger.warn("[DISCOVERY_CACHE] Cache miss on first page", {
          latencyMs: cacheLatency,
        });
      }
    }

    // If a cursor is provided, it must be valid; otherwise pagination can silently
    // behave like "page 1" (duplicates + missing items).
    if (cursorParam && !cursorIsValid) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }

    // --- TIPO DE ROW DE DB ---
    interface CommunityRow {
      id: string;
      name: string;
      imageAssetId: string | null;
      memberCount: number;
      feedBoardCount: number;
      recentPostCount7d: number;
      rankingScore: number;
    }

    // --- QUERY CON CURSOR PAGINATION ---
    // Keyset pagination: buscar communities con rankingScore MENOR que el cursor,
    // o mismo rankingScore pero ID mayor (para desempate consistente)
    // Además excluimos explícitamente el cursorId para evitar duplicados si el
    // ranking cambia entre requests (p.ej. cron cada 1 min) o por pequeñas
    // diferencias de redondeo de floats.
    //
    // Ahora usamos campos materializados => O(log N) con índice
    const cursorFilter =
      cursorScore !== null && cursorId !== null
        ? Prisma.sql`
          WHERE c.id <> ${cursorId} AND (
            c."rankingScore" < ${cursorScore}
            OR (
              c."rankingScore" >= ${cursorScore - RANKING_SCORE_EPSILON}
              AND c."rankingScore" <= ${cursorScore + RANKING_SCORE_EPSILON}
              AND c.id > ${cursorId}
            )
          )
        `
        : Prisma.sql``;

    // Query principal usando campos materializados
    // Index-only scan possible with (rankingScore DESC, id)
    const communities = await db.$queryRaw<CommunityRow[]>`
      SELECT
          c.id,
          c.name,
          c."imageAssetId",
          c."memberCount",
          c."feedBoardCount",
          c."recentPostCount7d",
          c."rankingScore"
      FROM "Community" c
      ${cursorFilter}
      ORDER BY c."rankingScore" DESC, c.id ASC
      LIMIT ${limit + 1}
    `;

    // --- Mapeo a la respuesta final con paginación ---
    const hasMore = communities.length > limit;
    const items = hasMore ? communities.slice(0, limit) : communities;
    const assetMap = await loadSerializedUploadedAssetMap(
      items.map((item) => item.imageAssetId),
    );

    const result: CommunityResult[] = items.map((r: CommunityRow) => ({
      id: r.id,
      name: r.name,
      description: null, // Community no tiene description
      imageAsset: r.imageAssetId ? (assetMap.get(r.imageAssetId) ?? null) : null,
      memberCount: r.memberCount,
      boardCount: r.feedBoardCount, // Boards actualmente en el feed
      recentPostCount7d: r.recentPostCount7d,
    }));

    // Cursor compuesto: "rankingScore_id" para keyset pagination correcta
    const lastItem = items.length > 0 ? items[items.length - 1] : null;
    const nextCursor =
      hasMore && lastItem
        ? `${Number(lastItem.rankingScore).toPrecision(17)}_${lastItem.id}`
        : null;

    if (cursorParam && cursorIsValid && items.length === 0) {
      logger.warn("[DISCOVERY_COMMUNITIES] Empty cursor page", {
        cursor: cursorParam,
        cursorScore,
        cursorId,
        limit,
      });
    }

    const response: PageResponse = {
      items: result,
      nextCursor,
      hasMore,
    };

    // Cache first page
    if (pageNumber === 1) {
      await communityFeedCache.setPage(1, response);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[DISCOVERY_COMMUNITIES_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
