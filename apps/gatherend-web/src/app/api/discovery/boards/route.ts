import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { boardFeedCache } from "@/lib/redis";
import { logger } from "@/lib/logger";
import {
  loadSerializedUploadedAssetMap,
  serializeUploadedAsset,
} from "@/lib/uploaded-assets";

// NO cachear a nivel de Next.js - usamos Redis para cache
export const dynamic = "force-dynamic";
export const revalidate = 0;

// --- CONSTANTES ---
const PAGE_SIZE = 20;
// Floats may not round-trip bit-perfect through cursor strings; use an epsilon
// so keyset pagination doesn't drop rows when many boards share the same score.
const RANKING_SCORE_EPSILON = 1e-9;

// --- TIPO DE RESPUESTA ---
interface BoardResult {
  id: string;
  name: string;
  imageAsset: ReturnType<typeof serializeUploadedAsset>;
  bannerAsset: ReturnType<typeof serializeUploadedAsset>;
  memberCount: number;
  recentPostCount7d: number;
}

interface PageResponse {
  items: BoardResult[];
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

    // Only cache first page (cursor-less)
    const isFirstPage = !cursorParam;

    if (isFirstPage) {
      const cacheStart = Date.now();
      const cached = await boardFeedCache.getPage<PageResponse>(1);
      const cacheLatency = Date.now() - cacheStart;

      if (cached) {
        if (cacheLatency > 50) {
          logger.warn("[DISCOVERY_CACHE] Slow cache hit", {
            latencyMs: cacheLatency,
          });
        }
        return NextResponse.json(cached);
      } else {
        logger.warn("[DISCOVERY_CACHE] Cache miss on first page", {
          latencyMs: cacheLatency,
        });
      }
    }

    // If a cursor is provided, it must be valid
    if (cursorParam && !cursorIsValid) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }

    // --- TIPO DE ROW DE DB ---
    interface BoardRow {
      id: string;
      name: string;
      imageAssetId: string | null;
      bannerAssetId: string | null;
      memberCount: number;
      recentPostCount7d: number;
      rankingScore: number;
    }

    // --- QUERY CON CURSOR PAGINATION ---
    // Keyset pagination: boards con rankingScore MENOR que el cursor,
    // o mismo rankingScore pero ID mayor (desempate consistente)
    const cursorFilter =
      cursorScore !== null && cursorId !== null
        ? Prisma.sql`
          AND b.id <> ${cursorId} AND (
            b."rankingScore" < ${cursorScore}
            OR (
              b."rankingScore" >= ${cursorScore - RANKING_SCORE_EPSILON}
              AND b."rankingScore" <= ${cursorScore + RANKING_SCORE_EPSILON}
              AND b.id > ${cursorId}
            )
          )
        `
        : Prisma.sql``;

    const boards = await db.$queryRaw<BoardRow[]>`
      SELECT
          b.id,
          b.name,
          b."imageAssetId",
          b."bannerAssetId",
          b."memberCount",
          b."recentPostCount7d",
          b."rankingScore"
      FROM "Board" b
      WHERE b."isPrivate" = false
        ${cursorFilter}
      ORDER BY b."rankingScore" DESC, b.id ASC
      LIMIT ${limit + 1}
    `;

    // --- Mapeo a la respuesta final con paginación ---
    const hasMore = boards.length > limit;
    const items = hasMore ? boards.slice(0, limit) : boards;
    const assetMap = await loadSerializedUploadedAssetMap(
      items.flatMap((item) => [item.imageAssetId, item.bannerAssetId]),
    );

    const result: BoardResult[] = items.map((b: BoardRow) => ({
      id: b.id,
      name: b.name,
      imageAsset: b.imageAssetId ? (assetMap.get(b.imageAssetId) ?? null) : null,
      bannerAsset: b.bannerAssetId ? (assetMap.get(b.bannerAssetId) ?? null) : null,
      memberCount: b.memberCount,
      recentPostCount7d: b.recentPostCount7d,
    }));

    // Cursor compuesto: "rankingScore_id"
    const lastItem = items.length > 0 ? items[items.length - 1] : null;
    const nextCursor =
      hasMore && lastItem
        ? `${Number(lastItem.rankingScore).toPrecision(17)}_${lastItem.id}`
        : null;

    if (cursorParam && cursorIsValid && items.length === 0) {
      logger.warn("[DISCOVERY_BOARDS] Empty cursor page", {
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
    if (isFirstPage) {
      await boardFeedCache.setPage(1, response);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[DISCOVERY_BOARDS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
