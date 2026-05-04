import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { isAdmin } from "@/lib/domain";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  req: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.inviteCode);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const params = await context.params;

    let action: unknown;
    try {
      const body = await req.json();
      action = body.action;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const boardId = params.boardId;

    // Validate boardId
    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    // Validate action
    if (
      typeof action !== "string" ||
      !action ||
      !["regenerate", "enable", "disable"].includes(action)
    ) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Ejecutar verificación de permisos y acción en transacción
    const updatedBoard = await db.$transaction(async (tx) => {
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

      // Solo OWNER y ADMIN pueden gestionar invite codes
      if (!isAdmin(member.role)) {
        throw new Error("FORBIDDEN");
      }

      // Ejecutar la acción
      const data =
        action === "regenerate"
          ? { inviteCode: uuidv4() }
          : { inviteEnabled: action === "enable" };

      return tx.board.update({
        where: { id: boardId },
        data,
        select: {
          id: true,
          inviteCode: true,
          inviteEnabled: true,
        },
      });
    });

    return NextResponse.json(updatedBoard);
  } catch (error) {
    // Manejar errores personalizados lanzados desde la transacción
    if (error instanceof Error) {
      if (error.message === "NOT_A_MEMBER")
        return NextResponse.json({ error: "Not a member" }, { status: 403 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error("[BOARD_INVITE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
