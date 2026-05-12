import { MemberRole, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { UUID_REGEX } from "@/lib/uploaded-assets";

const MAX_RULES_CONTENT_LENGTH = 10000;

const boardRulesSelect = {
  id: true,
  boardId: true,
  content: true,
  createdAt: true,
  updatedAt: true,
} as const;

type BoardRulesRecord = Prisma.BoardRulesGetPayload<{
  select: typeof boardRulesSelect;
}>;

function validateContent(content: unknown):
  | { success: true; content: string }
  | { success: false; error: string } {
  if (typeof content !== "string" || content.trim().length === 0) {
    return { success: false, error: "Content must be a non-empty string" };
  }
  if (content.trim().length > MAX_RULES_CONTENT_LENGTH) {
    return {
      success: false,
      error: `Content must be ${MAX_RULES_CONTENT_LENGTH} characters or less`,
    };
  }
  return { success: true, content: content.trim() };
}

function serializeBoardRules(rules: BoardRulesRecord) {
  return {
    id: rules.id,
    boardId: rules.boardId,
    content: rules.content,
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

    return NextResponse.json({ rules: serializeBoardRules(rules) });
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

    let body: { content?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validated = validateContent(body.content);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
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
        data: { boardId, content: validated.content },
        select: boardRulesSelect,
      });
    });

    return NextResponse.json(serializeBoardRules(rules), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      );
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

    let body: { content?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validated = validateContent(body.content);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
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
        data: { content: validated.content },
        select: boardRulesSelect,
      });
    });

    return NextResponse.json(serializeBoardRules(updated));
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
