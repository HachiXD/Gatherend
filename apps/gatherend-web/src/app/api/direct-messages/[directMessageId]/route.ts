import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Límites
const MAX_MESSAGE_LENGTH = 2000;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ directMessageId: string }> },
) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const { directMessageId } = await params;
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

    // Validate UUIDs
    if (!conversationId || !UUID_REGEX.test(conversationId)) {
      return NextResponse.json(
        { error: "Invalid conversation ID" },
        { status: 400 },
      );
    }

    if (!UUID_REGEX.test(directMessageId)) {
      return NextResponse.json(
        { error: "Invalid message ID" },
        { status: 400 },
      );
    }

    // Parse body with error handling
    let content: unknown;
    try {
      const body = await req.json();
      content = body.content;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Validate content
    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 },
      );
    }

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      return NextResponse.json(
        { error: "Content cannot be empty" },
        { status: 400 },
      );
    }

    if (trimmedContent.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters` },
        { status: 400 },
      );
    }

    // Auth check first
    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    // Verificar permisos y actualizar en transacción
    const updatedMessage = await db.$transaction(async (tx) => {
      const [conversation, directMessage] = await Promise.all([
        tx.conversation.findFirst({
          where: { id: conversationId },
          select: {
            id: true,
            profileOneId: true,
            profileTwoId: true,
          },
        }),
        tx.directMessage.findFirst({
          where: {
            id: directMessageId,
            conversationId: conversationId,
          },
          include: { sender: true },
        }),
      ]);

      if (!conversation) {
        throw new Error("CONVERSATION_NOT_FOUND");
      }

      const isParticipant =
        conversation.profileOneId === profile.id ||
        conversation.profileTwoId === profile.id;

      if (!isParticipant) {
        throw new Error("FORBIDDEN");
      }

      if (!directMessage || directMessage.deleted) {
        throw new Error("MESSAGE_NOT_FOUND");
      }

      if (directMessage.senderId !== profile.id) {
        throw new Error("FORBIDDEN");
      }

      if (directMessage.attachmentAssetId) {
        throw new Error("CANNOT_EDIT_FILE_MESSAGE");
      }

      return tx.directMessage.update({
        where: { id: directMessageId },
        data: { content: trimmedContent },
        include: { sender: true },
      });
    });

    // Notificar a Socket.IO (fire-and-forget)
    const updateKey = `chat:${conversationId}:messages:update`;

    fetch(`${process.env.SOCKET_SERVER_URL}/emit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": process.env.INTERNAL_API_SECRET || "",
      },
      body: JSON.stringify({
        channelKey: updateKey,
        data: updatedMessage,
      }),
      signal: AbortSignal.timeout(3000),
    }).catch((socketError) => {
      console.error("Error al emitir actualización:", socketError);
    });

    return NextResponse.json(updatedMessage);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "CONVERSATION_NOT_FOUND")
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 },
        );
      if (error.message === "MESSAGE_NOT_FOUND")
        return NextResponse.json(
          { error: "Message not found" },
          { status: 404 },
        );
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (error.message === "CANNOT_EDIT_FILE_MESSAGE")
        return NextResponse.json(
          { error: "Cannot edit message with file" },
          { status: 400 },
        );
    }
    console.error("[DIRECT_MESSAGE_ID_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ directMessageId: string }> },
) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const { directMessageId } = await params;
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

    // Validate UUIDs
    if (!conversationId || !UUID_REGEX.test(conversationId)) {
      return NextResponse.json(
        { error: "Invalid conversation ID" },
        { status: 400 },
      );
    }

    if (!UUID_REGEX.test(directMessageId)) {
      return NextResponse.json(
        { error: "Invalid message ID" },
        { status: 400 },
      );
    }

    // Auth check first
    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    // Verificar permisos y eliminar en transacción
    const deletedMessage = await db.$transaction(async (tx) => {
      const [conversation, directMessage] = await Promise.all([
        tx.conversation.findFirst({
          where: { id: conversationId },
          select: {
            id: true,
            profileOneId: true,
            profileTwoId: true,
          },
        }),
        tx.directMessage.findFirst({
          where: {
            id: directMessageId,
            conversationId: conversationId,
          },
          include: { sender: true },
        }),
      ]);

      if (!conversation) {
        throw new Error("CONVERSATION_NOT_FOUND");
      }

      const isParticipant =
        conversation.profileOneId === profile.id ||
        conversation.profileTwoId === profile.id;

      if (!isParticipant) {
        throw new Error("FORBIDDEN");
      }

      if (!directMessage || directMessage.deleted) {
        throw new Error("MESSAGE_NOT_FOUND");
      }

      if (directMessage.senderId !== profile.id) {
        throw new Error("FORBIDDEN");
      }

      return tx.directMessage.update({
        where: { id: directMessageId },
        data: {
          attachmentAssetId: null,
          content: "This message has been deleted.",
          deleted: true,
        },
        include: { sender: true },
      });
    });

    // Notificar a Socket.IO (fire-and-forget)
    const updateKey = `chat:${conversationId}:messages:update`;

    fetch(`${process.env.SOCKET_SERVER_URL}/emit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": process.env.INTERNAL_API_SECRET || "",
      },
      body: JSON.stringify({
        channelKey: updateKey,
        data: deletedMessage,
      }),
      signal: AbortSignal.timeout(3000),
    }).catch((socketError) => {
      console.error("Error al emitir eliminación:", socketError);
    });

    return NextResponse.json(deletedMessage);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "CONVERSATION_NOT_FOUND")
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 },
        );
      if (error.message === "MESSAGE_NOT_FOUND")
        return NextResponse.json(
          { error: "Message not found" },
          { status: 404 },
        );
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[DIRECT_MESSAGE_ID_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
