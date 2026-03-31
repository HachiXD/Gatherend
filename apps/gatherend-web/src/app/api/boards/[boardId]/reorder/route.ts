import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MemberRole } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const params = await context.params;
    const { boardId } = params;

    // Validate UUID
    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    let body: { id?: unknown; position?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { id, position } = body;

    if (!id || typeof id !== "string" || !UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid channel ID" }, { status: 400 });
    }

    if (typeof position !== "number") {
      return NextResponse.json({ error: "Invalid position" }, { status: 400 });
    }

    await db.$transaction(async (tx) => {
      const member = await tx.member.findFirst({
        where: { boardId, profileId: profile.id },
        select: { role: true },
      });

      const allowedRoles: MemberRole[] = [
        MemberRole.OWNER,
        MemberRole.ADMIN,
        MemberRole.MODERATOR,
      ];
      if (!member || !allowedRoles.includes(member.role)) {
        throw new Error("FORBIDDEN");
      }

      const updated = await tx.channel.updateMany({
        where: { id, boardId },
        data: { position },
      });

      if (updated.count === 0) throw new Error("NOT_FOUND");
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // Manejar errores personalizados lanzados desde la transacción
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN")
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 },
        );
      if (error.message === "NOT_FOUND")
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    console.error("[REORDER_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
