import { AssetContext, AssetVisibility } from "@prisma/client";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/domain";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { moderateDescription } from "@/lib/text-moderation";
import {
  findOwnedUploadedAsset,
  serializeProfileSummary,
  serializeUploadedAsset,
  uploadedAssetSummarySelect,
  UUID_REGEX,
} from "@/lib/uploaded-assets";

const MAX_CONTENT_LENGTH = 50_000;

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─── GET /api/boards/[boardId]/wiki/[pageId] ───────────────────────────────
// Returns the full content of a single wiki page.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ boardId: string; pageId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const { profile } = auth;

    const { boardId, pageId } = await params;

    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }
    if (!pageId || !UUID_REGEX.test(pageId)) {
      return NextResponse.json({ error: "Invalid page ID" }, { status: 400 });
    }

    const boardExists = await db.board.findFirst({
      where: { id: boardId, members: { some: { profileId: profile.id } } },
      select: { id: true },
    });

    if (!boardExists) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    const page = await db.wikiPage.findFirst({
      where: { id: pageId, boardId },
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

    if (!page) {
      return NextResponse.json(
        { error: "Wiki page not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      page: {
        id: page.id,
        title: page.title,
        content: page.content,
        imageAsset: serializeUploadedAsset(page.imageAsset),
        createdAt: page.createdAt.toISOString(),
        updatedAt: page.updatedAt.toISOString(),
        author: serializeProfileSummary(page.author),
      },
    });
  } catch (error) {
    console.error("[WIKI_PAGE_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// ─── PATCH /api/boards/[boardId]/wiki/[pageId] ────────────────────────────
// Author or admin can update title, content, or image.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ boardId: string; pageId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const { profile } = auth;

    const { boardId, pageId } = await params;

    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }
    if (!pageId || !UUID_REGEX.test(pageId)) {
      return NextResponse.json({ error: "Invalid page ID" }, { status: 400 });
    }

    let body: { title?: unknown; content?: unknown; imageAssetId?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { title, content, imageAssetId } = body;

    if (title === undefined && content === undefined && imageAssetId === undefined) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    if (title !== undefined && (typeof title !== "string" || !title.trim())) {
      return NextResponse.json(
        { error: "Title must be a non-empty string" },
        { status: 400 },
      );
    }

    if (content !== undefined && typeof content !== "string") {
      return NextResponse.json(
        { error: "Content must be a string" },
        { status: 400 },
      );
    }

    const trimmedContent =
      typeof content === "string" ? content.trim() : undefined;
    if (trimmedContent !== undefined && trimmedContent.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `Content must be ${MAX_CONTENT_LENGTH} characters or less` },
        { status: 400 },
      );
    }

    let resolvedImageAssetId: string | null | undefined = undefined;
    if (imageAssetId !== undefined) {
      if (imageAssetId === null || imageAssetId === "") {
        resolvedImageAssetId = null;
      } else if (
        typeof imageAssetId !== "string" ||
        !UUID_REGEX.test(imageAssetId)
      ) {
        return NextResponse.json(
          { error: "Image asset ID must be a valid UUID" },
          { status: 400 },
        );
      } else {
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
    }

    if (trimmedContent) {
      const moderationResult = moderateDescription(trimmedContent);
      if (!moderationResult.allowed) {
        return NextResponse.json(
          {
            error: "MODERATION_BLOCKED",
            message:
              moderationResult.message || "Content contains prohibited content",
            reason: moderationResult.reason,
          },
          { status: 400 },
        );
      }
    }

    const updatedPage = await db.$transaction(async (tx) => {
      const existingPage = await tx.wikiPage.findFirst({
        where: { id: pageId, boardId },
        select: {
          id: true,
          authorProfileId: true,
          title: true,
          content: true,
          imageAssetId: true,
        },
      });

      if (!existingPage) {
        throw new Error("PAGE_NOT_FOUND");
      }

      const member = await tx.member.findUnique({
        where: { boardId_profileId: { boardId, profileId: profile.id } },
        select: { role: true },
      });

      if (!member) {
        throw new Error("NOT_A_MEMBER");
      }

      const canEdit =
        existingPage.authorProfileId === profile.id || isAdmin(member.role);

      if (!canEdit) {
        throw new Error("FORBIDDEN");
      }

      return tx.wikiPage.update({
        where: { id: pageId },
        data: {
          ...(title !== undefined && { title: (title as string).trim() }),
          ...(trimmedContent !== undefined && { content: trimmedContent }),
          ...(resolvedImageAssetId !== undefined && {
            imageAssetId: resolvedImageAssetId,
          }),
        },
        select: {
          id: true,
          boardId: true,
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
    });

    return NextResponse.json({
      id: updatedPage.id,
      boardId: updatedPage.boardId,
      title: updatedPage.title,
      content: updatedPage.content,
      imageAsset: serializeUploadedAsset(updatedPage.imageAsset),
      createdAt: updatedPage.createdAt.toISOString(),
      updatedAt: updatedPage.updatedAt.toISOString(),
      author: serializeProfileSummary(updatedPage.author),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PAGE_NOT_FOUND") {
        return NextResponse.json(
          { error: "Wiki page not found" },
          { status: 404 },
        );
      }
      if (error.message === "NOT_A_MEMBER") {
        return NextResponse.json({ error: "Not a member" }, { status: 403 });
      }
      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          { error: "Only the author or an admin can edit this page" },
          { status: 403 },
        );
      }
    }

    console.error("[WIKI_PAGE_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// ─── DELETE /api/boards/[boardId]/wiki/[pageId] ───────────────────────────
// Author, moderator, or admin can delete a wiki page.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ boardId: string; pageId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const { profile } = auth;

    const { boardId, pageId } = await params;

    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }
    if (!pageId || !UUID_REGEX.test(pageId)) {
      return NextResponse.json({ error: "Invalid page ID" }, { status: 400 });
    }

    await db.$transaction(async (tx) => {
      const page = await tx.wikiPage.findFirst({
        where: { id: pageId, boardId },
        select: { id: true, authorProfileId: true },
      });

      if (!page) {
        throw new Error("PAGE_NOT_FOUND");
      }

      const member = await tx.member.findUnique({
        where: { boardId_profileId: { boardId, profileId: profile.id } },
        select: { role: true },
      });

      if (!member) {
        throw new Error("NOT_A_MEMBER");
      }

      const canDelete =
        page.authorProfileId === profile.id || isAdmin(member.role);

      if (!canDelete) {
        throw new Error("FORBIDDEN");
      }

      await tx.wikiPage.delete({ where: { id: pageId } });
    });

    return NextResponse.json({ success: true, deletedPageId: pageId });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PAGE_NOT_FOUND") {
        return NextResponse.json(
          { error: "Wiki page not found" },
          { status: 404 },
        );
      }
      if (error.message === "NOT_A_MEMBER") {
        return NextResponse.json({ error: "Not a member" }, { status: 403 });
      }
      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          {
            error:
              "Only the author, a moderator, or an admin can delete this page",
          },
          { status: 403 },
        );
      }
    }

    console.error("[WIKI_PAGE_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
