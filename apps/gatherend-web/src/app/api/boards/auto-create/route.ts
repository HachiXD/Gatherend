// app/api/boards/auto-create/route.ts

import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db";
import { hash } from "@/lib/hash";
import { MemberRole, Prisma } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { moderateDescription } from "@/lib/text-moderation";
import { createDefaultBoardChannelsForOwner } from "@/lib/boards/default-channels";

const IDEMPOTENCY_EXPIRATION_HOURS = 24;
const IDEMPOTENCY_STATUS_PENDING = 0;
const IDEMPOTENCY_STATUS_FAILED = -1;
const ENDPOINT = "/api/boards/auto-create";
const MAX_NAME_LENGTH = 50;

/**
 * Check if error is a Prisma unique constraint violation
 */
function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function POST(req: Request) {
  // Definir fuera del try para que esté disponible en el catch
  let compositeId: string | null = null;

  try {
    // Rate limiting - usar boardCreate (5 por minuto)
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.boardCreate);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    // 1. Idempotency key from header
    const idempotencyKey = req.headers.get("Idempotency-Key");
    if (!idempotencyKey) {
      return NextResponse.json(
        { error: "Idempotency-Key required" },
        { status: 400 },
      );
    }

    // Validar longitud del idempotency key (prevenir payloads excesivos)
    if (idempotencyKey.length > 64) {
      return NextResponse.json(
        { error: "Invalid Idempotency-Key format" },
        { status: 400 },
      );
    }

    // 2. Read and validate body
    const rawBody = await req.text();

    // Limit body size to prevent abuse.
    if (rawBody.length > 10000) {
      return NextResponse.json(
        { error: "Request body too large" },
        { status: 413 },
      );
    }

    const bodyHash = hash(rawBody);

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    // Validar longitud mínima
    if (name.length < 2) {
      return NextResponse.json(
        { error: "Board name must be at least 2 characters" },
        { status: 400 },
      );
    }

    // Validar longitud máxima
    if (name.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `Board name cannot exceed ${MAX_NAME_LENGTH} characters` },
        { status: 400 },
      );
    }

    // Moderar nombre del board
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

    // Composite key for idempotency (scoped to endpoint + key + user)
    // Asignar a la variable externa para que esté disponible en el catch
    compositeId = `${ENDPOINT}:${idempotencyKey}:${profile.id}`;

    // 3. Check if idempotency key already exists and is completed
    const existingKey = await db.idempotencyKey.findUnique({
      where: { id: compositeId },
    });

    if (existingKey && existingKey.expiresAt > new Date()) {
      // Key exists and is completed - return cached response
      if (
        existingKey.statusCode !== IDEMPOTENCY_STATUS_PENDING &&
        existingKey.statusCode !== IDEMPOTENCY_STATUS_FAILED
      ) {
        if (existingKey.bodyHash !== bodyHash) {
          return NextResponse.json(
            { error: "Request body mismatch" },
            { status: 409 },
          );
        }
        return new NextResponse(existingKey.responseJson, {
          status: existingKey.statusCode,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Key exists but is PENDING - another request is processing
      if (existingKey.statusCode === IDEMPOTENCY_STATUS_PENDING) {
        return NextResponse.json(
          { error: "Request already in progress" },
          { status: 409 },
        );
      }

      // Key exists but FAILED - allow retry by deleting the failed key
      if (existingKey.statusCode === IDEMPOTENCY_STATUS_FAILED) {
        await db.idempotencyKey.delete({ where: { id: compositeId } });
      }
    }

    // 4. Try to acquire lock by creating idempotency key with PENDING status
    // This is the critical section - only one request can succeed here
    try {
      await db.idempotencyKey.create({
        data: {
          id: compositeId,
          endpoint: ENDPOINT,
          userId: profile.id,
          bodyHash,
          responseJson: "", // Empty while pending
          statusCode: IDEMPOTENCY_STATUS_PENDING,
          expiresAt: new Date(
            Date.now() + IDEMPOTENCY_EXPIRATION_HOURS * 3600000,
          ),
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        // Another request won the race - fetch their result
        const winnerKey = await db.idempotencyKey.findUnique({
          where: { id: compositeId },
        });

        if (
          winnerKey &&
          winnerKey.statusCode !== IDEMPOTENCY_STATUS_PENDING &&
          winnerKey.statusCode !== IDEMPOTENCY_STATUS_FAILED
        ) {
          return new NextResponse(winnerKey.responseJson, {
            status: winnerKey.statusCode,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Winner is still processing or failed
        return NextResponse.json(
          { error: "Request already in progress" },
          { status: 409 },
        );
      }
      throw error;
    }

    // 5. We acquired the lock - now execute the business logic in a transaction
    const result = await db.$transaction(async (tx) => {
      // Check if user already has a board (inside transaction for consistency)
      const existingBoard = await tx.board.findFirst({
        where: {
          members: { some: { profileId: profile.id } },
        },
      });

      if (existingBoard) {
        return { board: existingBoard, created: false };
      }

      // Create new board
      const newBoard = await tx.board.create({
        data: {
          profileId: profile.id,
          name,
          inviteCode: uuidv4(),
          isPrivate: true,
          languages: profile.languages.length ? profile.languages : ["EN"],
          refreshedAt: new Date(),
        },
        select: { id: true },
      });

      const ownerMember = await tx.member.create({
        data: {
          boardId: newBoard.id,
          profileId: profile.id,
          role: MemberRole.OWNER,
        },
        select: {
          id: true,
        },
      });

      await createDefaultBoardChannelsForOwner(tx, {
        boardId: newBoard.id,
        ownerMemberId: ownerMember.id,
        ownerProfileId: profile.id,
      });

      const hydratedBoard = await tx.board.findUniqueOrThrow({
        where: { id: newBoard.id },
        include: {
          members: true,
          channels: {
            orderBy: { position: "asc" },
          },
        },
      });

      return { board: hydratedBoard, created: true };
    });

    const json = JSON.stringify(result.board);
    const statusCode = result.created ? 201 : 200;

    // 6. Update idempotency key with final result
    await db.idempotencyKey.update({
      where: { id: compositeId },
      data: {
        responseJson: json,
        statusCode,
      },
    });

    return new NextResponse(json, { status: statusCode });
  } catch (error) {
    // Mark idempotency key as FAILED instead of deleting
    // This prevents retry storms while allowing retry with same key after TTL
    // Solo intentar si compositeId fue definido (el error ocurrió después de ese punto)
    if (compositeId) {
      try {
        await db.idempotencyKey.update({
          where: { id: compositeId },
          data: {
            statusCode: IDEMPOTENCY_STATUS_FAILED,
            responseJson: JSON.stringify({ error: "Internal Error" }),
          },
        });
      } catch (cleanupError) {
        // Log cleanup errors for debugging
        console.error("[BOARDS_AUTO_CREATE_CLEANUP]", cleanupError);
      }
    }

    console.error("[BOARDS_AUTO_CREATE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
