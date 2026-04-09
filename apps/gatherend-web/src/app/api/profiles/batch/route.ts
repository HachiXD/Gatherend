import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import {
  serializeProfileSummary,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_IDS = 100;

const PROFILE_SELECT = {
  id: true,
  username: true,
  discriminator: true,
  usernameColor: true,
  usernameFormat: true,
  badge: true,
  profileTags: true,
  avatarAsset: {
    select: uploadedAssetSummarySelect,
  },
  badgeSticker: {
    select: {
      id: true,
      asset: {
        select: uploadedAssetSummarySelect,
      },
    },
  },
} as const;

// No cache
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;

    const body = await req.json();
    const rawIds = body?.ids;

    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return NextResponse.json(
        { error: "Ids must be a non-empty array" },
        { status: 400 },
      );
    }

    // Validate and deduplicate
    const ids = [
      ...new Set(
        rawIds
          .filter(
            (id): id is string => typeof id === "string" && UUID_REGEX.test(id),
          )
          .slice(0, MAX_IDS),
      ),
    ];

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "No valid UUIDs provided" },
        { status: 400 },
      );
    }

    const profiles = await db.profile.findMany({
      where: { id: { in: ids } },
      select: PROFILE_SELECT,
    });

    return NextResponse.json(profiles.map(serializeProfileSummary));
  } catch (error) {
    console.error("[PROFILES_BATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
