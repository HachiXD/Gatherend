import { AssetContext, AssetVisibility, MemberRole, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  UUID_REGEX,
  findOwnedUploadedAsset,
  serializeUploadedAsset,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 5000;

const boardRulesSelect = {
  id: true,
  boardId: true,
  title: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  imageAsset: {
    select: uploadedAssetSummarySelect,
  },
} as const;

// GET /api/boards/[boardId]/rules — any member can read
export async function GET(
  _req: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const { boardId } = await context.params;

    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    const membership = await db.member.findFirst({
      where: { boardId, profileId: profile.id },
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    const rules = await db.boardRules.findUnique({
      where: { boardId },
      select: boardRulesSelect,
    });

    if (!rules) {
      return NextResponse.json({ rules: null });
    }

    return NextResponse.json({
      rules: {
        id: rules.id,
        boardId: rules.boardId,
        title: rules.title,
        content: rules.content,
        imageAsset: serializeUploadedAsset(rules.imageAsset),
        createdAt: rules.createdAt.toISOString(),
        updatedAt: rules.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[BOARD_RULES_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// POST /api/boards/[boardId]/rules — OWNER or ADMIN only
export async function POST(
  req: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const { boardId } = await context.params;

    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    let body: { title?: unknown; content?: unknown; imageAssetId?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { title, content, imageAssetId } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 },
      );
    }

    const trimmedTitle = title.trim();
    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      return NextResponse.json(
        { error: `Title must be ${MAX_TITLE_LENGTH} characters or less` },
        { status: 400 },
      );
    }

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 },
      );
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `Content must be ${MAX_CONTENT_LENGTH} characters or less` },
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
        AssetContext.BOARD_RULES_IMAGE,
        AssetVisibility.PUBLIC,
      );

      if (!imageAsset) {
        return NextResponse.json(
          { error: "Board rules image asset not found" },
          { status: 400 },
        );
      }

      resolvedImageAssetId = imageAsset.id;
    }

    const rules = await db.$transaction(async (tx) => {
      const member = await tx.member.findFirst({
        where: {
          boardId,
          profileId: profile.id,
          role: { in: [MemberRole.OWNER, MemberRole.ADMIN] },
        },
        select: { role: true },
      });

      if (!member) {
        throw new Error("FORBIDDEN");
      }

      return tx.boardRules.create({
        data: {
          boardId,
          title: trimmedTitle,
          content: trimmedContent,
          imageAssetId: resolvedImageAssetId,
        },
        select: boardRulesSelect,
      });
    });

    return NextResponse.json(
      {
        id: rules.id,
        boardId: rules.boardId,
        title: rules.title,
        content: rules.content,
        imageAsset: serializeUploadedAsset(rules.imageAsset),
        createdAt: rules.createdAt.toISOString(),
        updatedAt: rules.updatedAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 },
        );
      }
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Rules already exist for this board" },
        { status: 409 },
      );
    }

    console.error("[BOARD_RULES_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// PATCH /api/boards/[boardId]/rules — OWNER or ADMIN only
export async function PATCH(
  req: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const { boardId } = await context.params;

    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    let body: { title?: unknown; content?: unknown; imageAssetId?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { title, content, imageAssetId } = body;

    if (title === undefined && content === undefined && imageAssetId === undefined) {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400 },
      );
    }

    let trimmedTitle: string | undefined;
    if (title !== undefined) {
      if (typeof title !== "string" || title.trim().length === 0) {
        return NextResponse.json(
          { error: "Title must be a non-empty string" },
          { status: 400 },
        );
      }
      trimmedTitle = title.trim();
      if (trimmedTitle.length > MAX_TITLE_LENGTH) {
        return NextResponse.json(
          { error: `Title must be ${MAX_TITLE_LENGTH} characters or less` },
          { status: 400 },
        );
      }
    }

    let trimmedContent: string | undefined;
    if (content !== undefined) {
      if (typeof content !== "string" || content.trim().length === 0) {
        return NextResponse.json(
          { error: "Content must be a non-empty string" },
          { status: 400 },
        );
      }
      trimmedContent = content.trim();
      if (trimmedContent.length > MAX_CONTENT_LENGTH) {
        return NextResponse.json(
          { error: `Content must be ${MAX_CONTENT_LENGTH} characters or less` },
          { status: 400 },
        );
      }
    }

    let resolvedImageAssetId: string | null | undefined;
    if (imageAssetId !== undefined) {
      if (imageAssetId === null || imageAssetId === "") {
        resolvedImageAssetId = null;
      } else if (typeof imageAssetId !== "string" || !UUID_REGEX.test(imageAssetId)) {
        return NextResponse.json(
          { error: "Image asset ID must be a valid UUID" },
          { status: 400 },
        );
      } else {
        const imageAsset = await findOwnedUploadedAsset(
          imageAssetId,
          profile.id,
          AssetContext.BOARD_RULES_IMAGE,
          AssetVisibility.PUBLIC,
        );

        if (!imageAsset) {
          return NextResponse.json(
            { error: "Board rules image asset not found" },
            { status: 400 },
          );
        }

        resolvedImageAssetId = imageAsset.id;
      }
    }

    const updated = await db.$transaction(async (tx) => {
      const member = await tx.member.findFirst({
        where: {
          boardId,
          profileId: profile.id,
          role: { in: [MemberRole.OWNER, MemberRole.ADMIN] },
        },
        select: { role: true },
      });

      if (!member) {
        throw new Error("FORBIDDEN");
      }

      const existing = await tx.boardRules.findUnique({
        where: { boardId },
        select: { id: true },
      });

      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      return tx.boardRules.update({
        where: { boardId },
        data: {
          ...(trimmedTitle !== undefined && { title: trimmedTitle }),
          ...(trimmedContent !== undefined && { content: trimmedContent }),
          ...(resolvedImageAssetId !== undefined && { imageAssetId: resolvedImageAssetId }),
        },
        select: boardRulesSelect,
      });
    });

    return NextResponse.json({
      id: updated.id,
      boardId: updated.boardId,
      title: updated.title,
      content: updated.content,
      imageAsset: serializeUploadedAsset(updated.imageAsset),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 },
        );
      }
      if (error.message === "NOT_FOUND") {
        return NextResponse.json(
          { error: "Board rules not found" },
          { status: 404 },
        );
      }
    }

    console.error("[BOARD_RULES_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// DELETE /api/boards/[boardId]/rules — OWNER or ADMIN only
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const { boardId } = await context.params;

    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    await db.$transaction(async (tx) => {
      const member = await tx.member.findFirst({
        where: {
          boardId,
          profileId: profile.id,
          role: { in: [MemberRole.OWNER, MemberRole.ADMIN] },
        },
        select: { role: true },
      });

      if (!member) {
        throw new Error("FORBIDDEN");
      }

      const existing = await tx.boardRules.findUnique({
        where: { boardId },
        select: { id: true },
      });

      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      await tx.boardRules.delete({ where: { boardId } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 },
        );
      }
      if (error.message === "NOT_FOUND") {
        return NextResponse.json(
          { error: "Board rules not found" },
          { status: 404 },
        );
      }
    }

    console.error("[BOARD_RULES_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
