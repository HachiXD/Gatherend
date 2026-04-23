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

const MAX_RULES_COUNT = 50;
const MAX_RULE_TITLE_LENGTH = 200;
const MAX_RULE_DESCRIPTION_LENGTH = 1000;

interface RuleItem {
  order: number;
  title: string;
  description: string | null;
}

const boardRulesSelect = {
  id: true,
  boardId: true,
  items: true,
  createdAt: true,
  updatedAt: true,
  imageAsset: {
    select: uploadedAssetSummarySelect,
  },
} as const;

type BoardRulesRecord = Prisma.BoardRulesGetPayload<{
  select: typeof boardRulesSelect;
}>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toRulesItemsInputJson(items: RuleItem[]): Prisma.InputJsonValue {
  return items as unknown as Prisma.InputJsonValue;
}

function validateRulesItems(items: unknown):
  | { success: true; items: RuleItem[] }
  | { success: false; error: string } {
  if (!Array.isArray(items)) {
    return {
      success: false,
      error: "Items must be an array",
    };
  }

  if (items.length === 0) {
    return {
      success: false,
      error: "At least one rule item is required",
    };
  }

  if (items.length > MAX_RULES_COUNT) {
    return {
      success: false,
      error: `Items must contain ${MAX_RULES_COUNT} rules or less`,
    };
  }

  const validatedItems: RuleItem[] = [];
  const allowedKeys = new Set(["order", "title", "description"]);

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];

    if (!isPlainObject(item)) {
      return {
        success: false,
        error: `Rule item ${index + 1} must be an object`,
      };
    }

    for (const key of Object.keys(item)) {
      if (!allowedKeys.has(key)) {
        return {
          success: false,
          error: `Rule item ${index + 1} contains an unsupported field: ${key}`,
        };
      }
    }

    const rawTitle = item.title;
    const rawDescription = item.description;

    if (typeof rawTitle !== "string" || rawTitle.trim().length === 0) {
      return {
        success: false,
        error: `Rule item ${index + 1} must have a non-empty title`,
      };
    }

    const trimmedTitle = rawTitle.trim();
    if (trimmedTitle.length > MAX_RULE_TITLE_LENGTH) {
      return {
        success: false,
        error: `Rule item ${index + 1} title must be ${MAX_RULE_TITLE_LENGTH} characters or less`,
      };
    }

    let normalizedDescription: string | null = null;
    if (rawDescription !== undefined && rawDescription !== null) {
      if (typeof rawDescription !== "string") {
        return {
          success: false,
          error: `Rule item ${index + 1} description must be a string or null`,
        };
      }

      const trimmedDescription = rawDescription.trim();
      if (trimmedDescription.length > MAX_RULE_DESCRIPTION_LENGTH) {
        return {
          success: false,
          error: `Rule item ${index + 1} description must be ${MAX_RULE_DESCRIPTION_LENGTH} characters or less`,
        };
      }

      normalizedDescription =
        trimmedDescription.length > 0 ? trimmedDescription : null;
    }

    validatedItems.push({
      order: index + 1,
      title: trimmedTitle,
      description: normalizedDescription,
    });
  }

  return {
    success: true,
    items: validatedItems,
  };
}

function serializeBoardRules(rules: BoardRulesRecord) {
  const validatedItems = validateRulesItems(rules.items);
  if (!validatedItems.success) {
    throw new Error("INVALID_RULES_ITEMS");
  }

  return {
    id: rules.id,
    boardId: rules.boardId,
    items: validatedItems.items,
    imageAsset: serializeUploadedAsset(rules.imageAsset),
    createdAt: rules.createdAt.toISOString(),
    updatedAt: rules.updatedAt.toISOString(),
  };
}

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
      rules: serializeBoardRules(rules),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_RULES_ITEMS") {
      console.error("[BOARD_RULES_GET_INVALID_ITEMS]", error);
      return NextResponse.json({ error: "Stored board rules are invalid" }, { status: 500 });
    }

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

    let body: { items?: unknown; imageAssetId?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { items, imageAssetId } = body;

    const validatedItems = validateRulesItems(items);
    if (!validatedItems.success) {
      return NextResponse.json(
        { error: validatedItems.error },
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
          items: toRulesItemsInputJson(validatedItems.items),
          imageAssetId: resolvedImageAssetId,
        },
        select: boardRulesSelect,
      });
    });

    return NextResponse.json(
      serializeBoardRules(rules),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_RULES_ITEMS") {
      console.error("[BOARD_RULES_POST_INVALID_ITEMS]", error);
      return NextResponse.json({ error: "Stored board rules are invalid" }, { status: 500 });
    }

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

    let body: { items?: unknown; imageAssetId?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { items, imageAssetId } = body;

    if (items === undefined && imageAssetId === undefined) {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400 },
      );
    }

    let normalizedItems: RuleItem[] | undefined;
    if (items !== undefined) {
      const validatedItems = validateRulesItems(items);
      if (!validatedItems.success) {
        return NextResponse.json(
          { error: validatedItems.error },
          { status: 400 },
        );
      }

      normalizedItems = validatedItems.items;
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
          ...(normalizedItems !== undefined && {
            items: toRulesItemsInputJson(normalizedItems),
          }),
          ...(resolvedImageAssetId !== undefined && { imageAssetId: resolvedImageAssetId }),
        },
        select: boardRulesSelect,
      });
    });

    return NextResponse.json(serializeBoardRules(updated));
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INVALID_RULES_ITEMS") {
        console.error("[BOARD_RULES_PATCH_INVALID_ITEMS]", error);
        return NextResponse.json(
          { error: "Stored board rules are invalid" },
          { status: 500 },
        );
      }
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
