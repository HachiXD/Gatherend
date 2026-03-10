import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { moderateDescription } from "@/lib/text-moderation";
import { MemberRole } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Allowed image URL prefixes (same as /api/boards/route.ts)
const ALLOWED_IMAGE_PREFIXES = [
  ...(process.env.NEXT_PUBLIC_DICEBEAR_URL
    ? [process.env.NEXT_PUBLIC_DICEBEAR_URL]
    : []),
  ...(process.env.NEXT_PUBLIC_CDN_URL ? [process.env.NEXT_PUBLIC_CDN_URL] : []),
];

function isAllowedImageUrl(url: string): boolean {
  return ALLOWED_IMAGE_PREFIXES.some((prefix) => url.startsWith(prefix));
}

// No cachear requests
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  req: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  try {
    // Rate limiting (más permisivo para navegación)
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const params = await context.params;
    const boardId = params.boardId;

    // Validate UUID
    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    // Usar autenticación real del servidor, no headers manipulables
    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const board = await db.board.findFirst({
      where: {
        id: boardId,
        members: { some: { profileId: profile.id } },
      },
      include: {
        channels: {
          where: { parentId: null },
          orderBy: { position: "asc" },
        },
        categories: {
          orderBy: { position: "asc" },
          include: {
            channels: {
              orderBy: { position: "asc" },
            },
          },
        },
        members: {
          orderBy: { role: "asc" },
          include: {
            profile: {
              select: {
                id: true,
                username: true,
                discriminator: true,
                imageUrl: true,
                userId: true,
                usernameColor: true,
                profileTags: true,
                badge: true,
                badgeStickerUrl: true,
                usernameFormat: true,
                // email omitido - no exponer en respuestas públicas
                // longDescription omitido - solo se necesita al abrir perfil completo
              },
            },
          },
        },
        slots: {
          include: {
            member: {
              include: {
                profile: {
                  select: {
                    id: true,
                    username: true,
                    discriminator: true,
                    imageUrl: true,
                    // email omitido - solo se muestra en board settings que usa board.members
                    userId: true,
                    usernameColor: true,
                    profileTags: true,
                    badge: true,
                    badgeStickerUrl: true,
                    usernameFormat: true,
                    // longDescription omitido - solo se necesita al abrir perfil completo
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    return NextResponse.json(board);
  } catch (error) {
    console.error("[BOARD_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(
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

    // Ejecutar verificación de permisos y eliminación en transacción
    await db.$transaction(async (tx) => {
      // Verificar que el usuario es OWNER del board
      const member = await tx.member.findFirst({
        where: { boardId, profileId: profile.id },
        select: { role: true },
      });

      if (!member) {
        throw new Error("NOT_A_MEMBER");
      }

      if (member.role !== MemberRole.OWNER) {
        throw new Error("FORBIDDEN");
      }

      // Eliminar el board (cascade eliminará members, channels, etc.)
      await tx.board.delete({
        where: { id: boardId },
      });
    });

    // Invalidar cache de la lista de boards
    revalidatePath("/boards");

    return NextResponse.json({ success: true, deletedBoardId: boardId });
  } catch (error) {
    // Manejar errores personalizados lanzados desde la transacción
    if (error instanceof Error) {
      if (error.message === "NOT_A_MEMBER")
        return NextResponse.json({ error: "Not a member" }, { status: 403 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json(
          { error: "Only the owner can delete the board" },
          { status: 403 },
        );
    }

    console.error("[BOARD_ID_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function PATCH(
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

    // Parse body with error handling
    let body: { name?: unknown; imageUrl?: unknown; description?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { name, imageUrl, description } = body;

    // Validar tipos y longitudes
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length < 2) {
        return NextResponse.json(
          { error: "Board name must be at least 2 characters" },
          { status: 400 },
        );
      }
      if (name.length > 50) {
        return NextResponse.json(
          { error: "Board name cannot exceed 50 characters" },
          { status: 400 },
        );
      }
    }

    // Validar imageUrl si se proporciona
    if (imageUrl !== undefined && imageUrl !== null && imageUrl !== "") {
      if (typeof imageUrl !== "string") {
        return NextResponse.json(
          { error: "Image URL must be a string" },
          { status: 400 },
        );
      }
      // Validar que sea una URL de nuestros CDNs permitidos
      if (!isAllowedImageUrl(imageUrl)) {
        return NextResponse.json(
          { error: "Image must be from an allowed source" },
          { status: 400 },
        );
      }
    }

    if (description !== undefined && description !== null) {
      if (typeof description !== "string") {
        return NextResponse.json(
          { error: "Description must be a string" },
          { status: 400 },
        );
      }
      if (description.length > 300) {
        return NextResponse.json(
          { error: "Description cannot exceed 300 characters" },
          { status: 400 },
        );
      }
    }

    // MODERACIÓN DE CONTENIDO

    // Moderar descripción si se está actualizando
    if (
      description &&
      typeof description === "string" &&
      description.trim().length > 0
    ) {
      const descModeration = moderateDescription(description);
      if (!descModeration.allowed) {
        return NextResponse.json(
          {
            error: "MODERATION_BLOCKED",
            message:
              descModeration.message ||
              "Description contains prohibited content",
            reason: descModeration.reason,
          },
          { status: 400 },
        );
      }
    }

    // Moderar nombre si se está actualizando
    if (name && typeof name === "string" && name.trim().length > 0) {
      const nameModeration = moderateDescription(name);
      if (!nameModeration.allowed) {
        return NextResponse.json(
          {
            error: "MODERATION_BLOCKED",
            message: "Board name contains prohibited content",
            reason: nameModeration.reason,
          },
          { status: 400 },
        );
      }
    }

    // Ejecutar verificación de permisos y actualización en transacción para evitar TOCTOU
    const board = await db.$transaction(async (tx) => {
      // Verificar permisos: solo owner o admin pueden editar
      const member = await tx.member.findFirst({
        where: { boardId, profileId: profile.id },
        select: { role: true },
      });

      if (!member) {
        throw new Error("NOT_A_MEMBER");
      }

      if (
        member.role !== MemberRole.OWNER &&
        member.role !== MemberRole.ADMIN
      ) {
        throw new Error("FORBIDDEN");
      }

      return tx.board.update({
        where: { id: boardId },
        data: {
          ...(name !== undefined && { name: (name as string).trim() }),
          ...(imageUrl !== undefined && {
            imageUrl: imageUrl as string | null,
          }),
          ...(description !== undefined && {
            description: description ? (description as string).trim() : null,
          }),
        },
      });
    });

    // Invalidar cache del layout del board y lista de boards
    revalidatePath(`/boards/${boardId}`);
    revalidatePath("/boards");

    return NextResponse.json(board);
  } catch (error) {
    // Manejar errores personalizados lanzados desde la transacción
    if (error instanceof Error) {
      if (error.message === "NOT_A_MEMBER")
        return NextResponse.json({ error: "Not a member" }, { status: 403 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json(
          { error: "Only owner or admin can edit board settings" },
          { status: 403 },
        );
    }

    console.error("[BOARD_ID_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
