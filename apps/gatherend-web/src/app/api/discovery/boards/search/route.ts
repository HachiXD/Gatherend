import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import {
  loadSerializedUploadedAssetMap,
  serializeUploadedAsset,
} from "@/lib/uploaded-assets";

// NO cachear - búsqueda siempre fresh
export const dynamic = "force-dynamic";
export const revalidate = 0;

// --- CONSTANTES ---
const PAGE_SIZE = 20;
const MAX_LIMIT = 50;

// --- TIPOS ---
interface BoardSearchResult {
  id: string;
  name: string;
  imageAsset: ReturnType<typeof serializeUploadedAsset>;
  memberCount: number;
  recentPostCount7d: number;
  rankingScore: number;
}

interface SearchResponse {
  items: BoardSearchResult[];
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
    const q = searchParams.get("q")?.trim() || "";
    const cursorParam = searchParams.get("cursor");
    const limitParam = parseInt(
      searchParams.get("limit") || String(PAGE_SIZE),
      10,
    );
    const limit = Math.min(
      Number.isNaN(limitParam) ? PAGE_SIZE : limitParam,
      MAX_LIMIT,
    );

    if (!q) {
      return NextResponse.json<SearchResponse>({
        items: [],
        nextCursor: null,
        hasMore: false,
      });
    }

    // Sanitizar query - remover caracteres especiales
    const sanitizedQuery = q.replace(/[^\w\sáéíóúñÁÉÍÓÚÑ]/g, " ").trim();

    if (!sanitizedQuery) {
      return NextResponse.json<SearchResponse>({
        items: [],
        nextCursor: null,
        hasMore: false,
      });
    }

    // --- PARSEAR CURSOR ---
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let cursorScore: number | null = null;
    let cursorId: string | null = null;

    if (cursorParam) {
      // Security: Validate cursor length
      if (cursorParam.length > 100) {
        return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
      }

      const separatorIndex = cursorParam.indexOf("_");
      if (separatorIndex > 0) {
        const scoreStr = cursorParam.slice(0, separatorIndex);
        const id = cursorParam.slice(separatorIndex + 1);
        const score = parseFloat(scoreStr);

        if (
          Number.isFinite(score) &&
          score >= -1e10 &&
          score <= 1e10 &&
          uuidRegex.test(id)
        ) {
          cursorScore = score;
          cursorId = id;
        }
      }
    }

    interface BoardRow {
      id: string;
      name: string;
      imageAssetId: string | null;
      memberCount: number;
      recentPostCount7d: number;
      rankingScore: number;
    }

    let boards: BoardRow[];

    if (cursorScore !== null && cursorId !== null) {
      // Página siguiente con cursor
      boards = await db.$queryRaw<BoardRow[]>`
        SELECT
          b.id,
          b.name,
          b."imageAssetId",
          b."memberCount",
          b."recentPostCount7d",
          b."rankingScore"
        FROM "Board" b
        WHERE b."isPrivate" = false
          AND b.name ILIKE ${`%${sanitizedQuery}%`}
          AND (
            b."rankingScore" < ${cursorScore}
            OR (b."rankingScore" = ${cursorScore} AND b.id > ${cursorId})
          )
        ORDER BY b."rankingScore" DESC, b.id ASC
        LIMIT ${limit + 1}
      `;
    } else {
      // Primera página
      boards = await db.$queryRaw<BoardRow[]>`
        SELECT
          b.id,
          b.name,
          b."imageAssetId",
          b."memberCount",
          b."recentPostCount7d",
          b."rankingScore"
        FROM "Board" b
        WHERE b."isPrivate" = false
          AND b.name ILIKE ${`%${sanitizedQuery}%`}
        ORDER BY b."rankingScore" DESC, b.id ASC
        LIMIT ${limit + 1}
      `;
    }

    // --- PAGINACIÓN ---
    const hasMore = boards.length > limit;
    const items = hasMore ? boards.slice(0, limit) : boards;
    const assetMap = await loadSerializedUploadedAssetMap(
      items.map((item) => item.imageAssetId),
    );

    const result: BoardSearchResult[] = items.map((b) => ({
      id: b.id,
      name: b.name,
      imageAsset: b.imageAssetId ? (assetMap.get(b.imageAssetId) ?? null) : null,
      memberCount: b.memberCount,
      recentPostCount7d: b.recentPostCount7d,
      rankingScore: b.rankingScore,
    }));

    const lastItem = items.length > 0 ? items[items.length - 1] : null;
    const nextCursor =
      hasMore && lastItem ? `${lastItem.rankingScore}_${lastItem.id}` : null;

    return NextResponse.json<SearchResponse>({
      items: result,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error("[BOARD_SEARCH_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
