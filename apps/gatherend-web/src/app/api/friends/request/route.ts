import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import {
  serializeProfileSummary,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";

// Límites
const MAX_USERNAME_LENGTH = 100;

const friendshipProfileSelect = {
  id: true,
  username: true,
  discriminator: true,
  usernameColor: true,
  profileTags: true,
  badge: true,
  usernameFormat: true,
  avatarAsset: {
    select: uploadedAssetSummarySelect,
  },
  badgeSticker: {
    select: {
      id: true,
      asset: {
        select: uploadedAssetSummarySelect,
      },
    },
  },
} as const;

export async function POST(req: Request) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    // Parse body with error handling
    let name: unknown;
    try {
      const body = await req.json();
      name = body.name;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Required", message: "Username/discriminator is required" },
        { status: 400 },
      );
    }

    // Límite de longitud
    if (name.length > MAX_USERNAME_LENGTH) {
      return NextResponse.json(
        { error: "Too long", message: "Username is too long" },
        { status: 400 },
      );
    }

    const trimmedInput = name.trim();

    // Parsear el formato username/discriminator
    const parts = trimmedInput.split("/");
    if (parts.length !== 2) {
      return NextResponse.json(
        {
          error: "Invalid format",
          message: "Use format: username/discriminator (e.g. alejandro/g5x)",
        },
        { status: 400 },
      );
    }

    const [username, discriminator] = parts.map((p) => p.trim());

    if (!username || !discriminator) {
      return NextResponse.json(
        {
          error: "Invalid format",
          message: "Both username and discriminator are required",
        },
        { status: 400 },
      );
    }

    // Ejecutar en transacción para evitar race conditions
    const result = await db.$transaction(async (tx) => {
      // Buscar el profile por username y discriminator
      const targetProfile = await tx.profile.findFirst({
        where: {
          username: {
            equals: username,
            mode: "insensitive",
          },
          discriminator: {
            equals: discriminator,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          username: true,
          discriminator: true,
          avatarAsset: {
            select: uploadedAssetSummarySelect,
          },
        },
      });

      if (!targetProfile) {
        throw new Error("USER_NOT_FOUND");
      }

      if (targetProfile.id === profile.id) {
        throw new Error("SELF_REQUEST");
      }

      // Verificar si ya existe una relación de amistad
      const existingFriendship = await tx.friendship.findFirst({
        where: {
          OR: [
            { requesterId: profile.id, receiverId: targetProfile.id },
            { requesterId: targetProfile.id, receiverId: profile.id },
          ],
        },
      });

      if (existingFriendship) {
        if (existingFriendship.status === "PENDING") {
          throw new Error("ALREADY_PENDING");
        } else if (existingFriendship.status === "ACCEPTED") {
          throw new Error("ALREADY_FRIENDS");
        } else if (existingFriendship.status === "BLOCKED") {
          throw new Error("BLOCKED");
        } else if (existingFriendship.status === "REJECTED") {
          // Permitir re-envío: UPDATE el registro existente a PENDING
          const updatedFriendship = await tx.friendship.update({
            where: { id: existingFriendship.id },
            data: {
              status: "PENDING",
              requesterId: profile.id,
              receiverId: targetProfile.id,
            },
            include: {
              requester: {
                select: friendshipProfileSelect,
              },
              receiver: {
                select: friendshipProfileSelect,
              },
            },
          });
          return {
            friendship: updatedFriendship,
            targetProfileId: targetProfile.id,
          };
        }
      }

      // Crear la solicitud de amistad
      const friendship = await tx.friendship.create({
        data: {
          requesterId: profile.id,
          receiverId: targetProfile.id,
          status: "PENDING",
        },
        include: {
          requester: {
            select: friendshipProfileSelect,
          },
          receiver: {
            select: friendshipProfileSelect,
          },
        },
      });

      return { friendship, targetProfileId: targetProfile.id };
    });

    // Emitir evento de socket (fuera de la transacción)
    const socketUrl = process.env.SOCKET_SERVER_URL;
    if (socketUrl) {
      const serializedFriendship = {
        ...result.friendship,
        requester: serializeProfileSummary(result.friendship.requester),
        receiver: serializeProfileSummary(result.friendship.receiver),
      };

      fetch(`${socketUrl}/emit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": process.env.INTERNAL_API_SECRET || "",
        },
        body: JSON.stringify({
          channelKey: `user:${result.targetProfileId}:friend-request`,
          data: {
            type: "new",
            friendship: serializedFriendship,
          },
        }),
        signal: AbortSignal.timeout(3000),
      }).catch((err) =>
        console.error("Error emitting friend request event:", err),
      );
    }

    return NextResponse.json({
      success: true,
      message: "Friend request sent!",
      friendship: {
        ...result.friendship,
        requester: serializeProfileSummary(result.friendship.requester),
        receiver: serializeProfileSummary(result.friendship.receiver),
      },
    });
  } catch (error) {
    // Manejar errores de la transacción
    if (error instanceof Error) {
      if (error.message === "USER_NOT_FOUND")
        return NextResponse.json(
          { error: "Request failed", message: "Unable to send friend request" },
          { status: 400 },
        );
      if (error.message === "SELF_REQUEST")
        return NextResponse.json(
          {
            error: "Invalid request",
            message: "Unable to send friend request",
          },
          { status: 400 },
        );
      if (error.message === "ALREADY_PENDING")
        return NextResponse.json(
          {
            error: "Request exists",
            message: "A friend request already exists",
          },
          { status: 400 },
        );
      if (error.message === "ALREADY_FRIENDS")
        return NextResponse.json(
          { error: "Already friends", message: "You are already friends" },
          { status: 400 },
        );
      if (error.message === "BLOCKED")
        return NextResponse.json(
          { error: "Request failed", message: "Unable to send friend request" },
          { status: 400 },
        );
    }
    console.error("[FRIEND_REQUEST_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
