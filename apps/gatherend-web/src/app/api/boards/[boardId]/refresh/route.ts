import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { isAdmin } from "@/lib/domain";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 12 horas en ms
const REFRESH_COOLDOWN_MS = 12 * 60 * 60 * 1000;

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

    const boardId = params.boardId;

    // Validate UUID
    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    // Ejecutar toda la lógica dentro de una transacción para consistencia
    const result = await db.$transaction(async (tx) => {
      // 1) Validar que el usuario sea miembro y su rol
      const member = await tx.member.findFirst({
        where: {
          boardId,
          profileId: profile.id,
        },
        select: { role: true },
      });

      if (!member) {
        throw new Error("NOT_A_MEMBER");
      }

      if (!isAdmin(member.role)) {
        throw new Error("FORBIDDEN");
      }

      // 2) Traer board con refreshedAt
      const board = await tx.board.findUnique({
        where: { id: boardId },
        select: {
          id: true,
          refreshedAt: true,
        },
      });

      if (!board) {
        throw new Error("BOARD_NOT_FOUND");
      }

      // 3) Validar cooldown
      const now = Date.now();
      const lastRefresh = board.refreshedAt ? board.refreshedAt.getTime() : 0;
      const diff = now - lastRefresh;

      if (diff < REFRESH_COOLDOWN_MS) {
        const minutesLeft = Math.ceil((REFRESH_COOLDOWN_MS - diff) / 60_000);
        throw new Error(`COOLDOWN:${minutesLeft}`);
      }

      // 4) Actualizar refreshedAt
      const updated = await tx.board.update({
        where: { id: boardId },
        data: { refreshedAt: new Date() },
        select: {
          id: true,
          refreshedAt: true,
        },
      });

      return updated;
    });

    // Emitir evento de discovery si el board es público
    return NextResponse.json({
      success: true,
      boardId: result.id,
      refreshedAt: result.refreshedAt,
    });
  } catch (error) {
    // Manejar errores personalizados lanzados desde la transacción
    if (error instanceof Error) {
      if (error.message === "NOT_A_MEMBER")
        return NextResponse.json({ error: "Not a member" }, { status: 403 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json(
          { error: "Only owner/admin can refresh" },
          { status: 403 },
        );
      if (error.message === "BOARD_NOT_FOUND")
        return NextResponse.json({ error: "Board not found" }, { status: 404 });
      if (error.message.startsWith("COOLDOWN:")) {
        const minutesLeft = parseInt(error.message.split(":")[1], 10);
        return NextResponse.json(
          {
            success: false,
            error: "Cooldown active",
            minutesLeft,
          },
          { status: 429 },
        );
      }
    }

    console.error("[BOARD_REFRESH_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
