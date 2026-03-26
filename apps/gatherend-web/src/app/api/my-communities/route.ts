// app/api/communities/my/route.ts

// Obtiene las comunidades de las que el usuario es miembro
// a partir de la membresía explícita en CommunityMember.

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

    const memberships = await db.communityMember.findMany({
      where: {
        profileId: profile.id,
      },
      select: {
        community: {
          select: {
            id: true,
            name: true,
            imageAsset: {
              select: uploadedAssetSummarySelect,
            },
          },
        },
      },
    });

    const result = memberships
      .map((membership) => ({
        id: membership.community.id,
        name: membership.community.name,
        imageAsset: serializeUploadedAsset(membership.community.imageAsset),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(result);
  } catch (error) {
    console.error("[MY_COMMUNITIES_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
