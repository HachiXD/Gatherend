// app/api/communities/my/route.ts

// Obtiene las comunidades de las que el usuario es miembro
// (derivado de estar en al menos un board de esa comunidad)

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import {
  serializeUploadedAsset,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";

export interface MyCommunity {
  id: string;
  name: string;
  imageAsset: ReturnType<typeof serializeUploadedAsset>;
  boardCount: number; // boards del usuario en esta comunidad
  totalBoardCount: number; // total de boards de la comunidad
}

// GET - Listar comunidades del usuario

export async function GET() {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const { profile } = auth;

    // Obtener todos los boards del usuario que pertenecen a una comunidad
    const userBoardsInCommunities = await db.board.findMany({
      where: {
        members: {
          some: {
            profileId: profile.id,
          },
        },
        communityId: {
          not: null,
        },
      },
      select: {
        communityId: true,
        community: {
          select: {
            id: true,
            name: true,
            imageAsset: {
              select: uploadedAssetSummarySelect,
            },
            _count: {
              select: {
                boards: true,
              },
            },
          },
        },
      },
    });

    // Agrupar por comunidad y contar boards del usuario
    const communityMap = new Map<string, MyCommunity>();

    for (const board of userBoardsInCommunities) {
      if (!board.communityId || !board.community) continue;

      const existing = communityMap.get(board.communityId);
      if (existing) {
        existing.boardCount += 1;
      } else {
        communityMap.set(board.communityId, {
          id: board.community.id,
          name: board.community.name,
          imageAsset: serializeUploadedAsset(board.community.imageAsset),
          boardCount: 1,
          totalBoardCount: board.community._count.boards,
        });
      }
    }

    // Convertir a array y ordenar por nombre
    const result = Array.from(communityMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[MY_COMMUNITIES_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
