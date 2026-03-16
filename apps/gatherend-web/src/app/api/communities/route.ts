import { AssetContext, AssetVisibility, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { moderateDescription } from "@/lib/text-moderation";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  UUID_REGEX,
  findOwnedUploadedAsset,
  serializeUploadedAsset,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_NAME_LENGTH = 50;
const MIN_NAME_LENGTH = 2;

export async function GET(req: Request) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;

    const { searchParams } = new URL(req.url);
    const rawSearch = searchParams.get("search")?.trim() || "";
    const search = rawSearch.slice(0, 100);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

    const whereClause = search
      ? {
          name: {
            contains: search,
            mode: "insensitive" as const,
          },
        }
      : {};

    const communities = await db.community.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        memberCount: true,
        feedBoardCount: true,
        rankingScore: true,
        imageAsset: {
          select: uploadedAssetSummarySelect,
        },
      },
      orderBy: [{ rankingScore: "desc" }, { name: "asc" }],
      take: limit,
    });

    return NextResponse.json(
      communities.map((community) => ({
        id: community.id,
        name: community.name,
        imageAsset: serializeUploadedAsset(community.imageAsset),
        memberCount: community.memberCount,
        boardCount: community.feedBoardCount,
      })),
    );
  } catch (error) {
    console.error("[COMMUNITIES_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.boardCreate);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { name, imageAssetId }: { name?: unknown; imageAssetId?: unknown } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Name is required and must be a string" },
        { status: 400 },
      );
    }

    const trimmedName = name.trim();
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

    let resolvedImageAssetId: string | null = null;
    if (imageAssetId !== undefined && imageAssetId !== null && imageAssetId !== "") {
      if (typeof imageAssetId !== "string" || !UUID_REGEX.test(imageAssetId)) {
        return NextResponse.json(
          { error: "Image asset ID must be a valid UUID" },
          { status: 400 },
        );
      }

      const imageAsset = await findOwnedUploadedAsset(
        imageAssetId,
        profile.id,
        AssetContext.COMMUNITY_IMAGE,
        AssetVisibility.PUBLIC,
      );

      if (!imageAsset) {
        return NextResponse.json(
          { error: "Community image asset not found" },
          { status: 400 },
        );
      }

      resolvedImageAssetId = imageAsset.id;
    }

    const community = await db.$transaction(async (tx) => {
      const newCommunity = await tx.community.create({
        data: {
          name: trimmedName,
          imageAssetId: resolvedImageAssetId,
        },
        select: {
          id: true,
          name: true,
          imageAsset: {
            select: uploadedAssetSummarySelect,
          },
        },
      });

      await tx.communityHelper.create({
        data: {
          communityId: newCommunity.id,
          profileId: profile.id,
        },
      });

      return newCommunity;
    });

    return NextResponse.json({
      ...community,
      imageAsset: serializeUploadedAsset(community.imageAsset),
    });
  } catch (error) {
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
