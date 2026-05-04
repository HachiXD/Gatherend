import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { AssetContext, AssetVisibility } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import {
  serializeProfileSummary,
  serializeUploadedAsset,
  uploadedAssetSummarySelect,
  findOwnedUploadedAsset,
  UUID_REGEX,
} from "@/lib/uploaded-assets";
import { canWriteWiki } from "@/lib/domain";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 20;
const MAX_LIMIT = 50;
const MAX_CURSOR_LENGTH = 128;
const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 50000;

// ─── GET /api/boards/[boardId]/wiki ────────────────────────────────────────
// Returns a paginated index of wiki pages (title-only preview) for the board.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const { profile } = auth;

    const { boardId } = await params;

    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    const boardExists = await db.board.findFirst({
      where: { id: boardId, members: { some: { profileId: profile.id } } },
      select: { id: true },
    });

    if (!boardExists) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const cursorParam = searchParams.get("cursor");
    const limitParam = parseInt(
      searchParams.get("limit") || String(PAGE_SIZE),
      10,
    );
    const limit = Math.min(
      Number.isNaN(limitParam) ? PAGE_SIZE : limitParam,
      MAX_LIMIT,
    );

    let cursorCreatedAt: Date | null = null;
    let cursorId: string | null = null;

    if (cursorParam) {
      if (cursorParam.length > MAX_CURSOR_LENGTH) {
        return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
      }
      const [createdAtStr, id] = cursorParam.split("|");
      if (!createdAtStr || !id || !UUID_REGEX.test(id)) {
        return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
      }
      const parsedCreatedAt = new Date(createdAtStr);
      if (Number.isNaN(parsedCreatedAt.getTime())) {
        return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
      }
      cursorCreatedAt = parsedCreatedAt;
      cursorId = id;
    }

    const pages = await db.wikiPage.findMany({
      where: {
        boardId,
        ...(cursorCreatedAt && cursorId
          ? {
              OR: [
                { createdAt: { lt: cursorCreatedAt } },
                {
                  AND: [
                    { createdAt: cursorCreatedAt },
                    { id: { lt: cursorId } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            username: true,
            discriminator: true,
            badge: true,
            usernameColor: true,
            usernameFormat: true,
            profileTags: true,
            avatarAsset: { select: uploadedAssetSummarySelect },
            badgeSticker: {
              select: {
                id: true,
                asset: { select: uploadedAssetSummarySelect },
              },
            },
          },
        },
      },
    });

    const hasMore = pages.length > limit;
    const items = hasMore ? pages.slice(0, limit) : pages;
    const lastItem = items.length > 0 ? items[items.length - 1] : null;
    const nextCursor =
      hasMore && lastItem
        ? `${lastItem.createdAt.toISOString()}|${lastItem.id}`
        : null;

    return NextResponse.json({
      items: items.map((page) => ({
        id: page.id,
        title: page.title,
        createdAt: page.createdAt.toISOString(),
        updatedAt: page.updatedAt.toISOString(),
        author: serializeProfileSummary(page.author),
      })),
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error("[WIKI_LIST_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// ─── POST /api/boards/[boardId]/wiki ───────────────────────────────────────
// Creates a new wiki page. Requires canWriteWiki permission.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const { profile } = auth;

    const { boardId } = await params;

    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const { title, content, imageAssetId } = body as {
      title?: unknown;
      content?: unknown;
      imageAssetId?: unknown;
    };

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    const trimmedTitle = title.trim();
    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      return NextResponse.json(
        { error: `Title must be ${MAX_TITLE_LENGTH} characters or less` },
        { status: 400 },
      );
    }

    const trimmedContent = typeof content === "string" ? content.trim() : "";
    if (trimmedContent.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `Content must be ${MAX_CONTENT_LENGTH} characters or less` },
        { status: 400 },
      );
    }

    const member = await db.member.findFirst({
      where: { boardId, profileId: profile.id },
      select: { role: true, permissions: true },
    });

    if (!member) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    if (!canWriteWiki(member.role, member.permissions)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let resolvedImageAssetId: string | null = null;
    if (
      imageAssetId !== undefined &&
      imageAssetId !== null &&
      imageAssetId !== ""
    ) {
      if (typeof imageAssetId !== "string" || !UUID_REGEX.test(imageAssetId)) {
        return NextResponse.json(
          { error: "Image asset ID must be a valid UUID" },
          { status: 400 },
        );
      }
      const imageAsset = await findOwnedUploadedAsset(
        imageAssetId,
        profile.id,
        AssetContext.WIKI_PAGE_IMAGE,
        AssetVisibility.PUBLIC,
      );
      if (!imageAsset) {
        return NextResponse.json(
          { error: "Wiki page image asset not found" },
          { status: 400 },
        );
      }
      resolvedImageAssetId = imageAsset.id;
    }

    const page = await db.wikiPage.create({
      data: {
        boardId,
        authorProfileId: profile.id,
        title: trimmedTitle,
        content: trimmedContent,
        imageAssetId: resolvedImageAssetId,
      },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        imageAsset: { select: uploadedAssetSummarySelect },
        author: {
          select: {
            id: true,
            username: true,
            discriminator: true,
            badge: true,
            usernameColor: true,
            usernameFormat: true,
            profileTags: true,
            avatarAsset: { select: uploadedAssetSummarySelect },
            badgeSticker: {
              select: {
                id: true,
                asset: { select: uploadedAssetSummarySelect },
              },
            },
          },
        },
      },
    });

    return NextResponse.json(
      {
        page: {
          id: page.id,
          title: page.title,
          content: page.content,
          imageAsset: serializeUploadedAsset(page.imageAsset),
          createdAt: page.createdAt.toISOString(),
          updatedAt: page.updatedAt.toISOString(),
          author: serializeProfileSummary(page.author),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[WIKI_CREATE_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
