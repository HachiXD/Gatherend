import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  normalizeUsername,
  validateUsername,
  MAX_DISCRIMINATORS,
} from "@/lib/username";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/auth/check-username
 * Verifica si un username está disponible (para sign-up)
 *
 * Un username está disponible si quedan discriminators libres para él.
 * Cada username puede tener hasta 46,656 usuarios (36^3 combinaciones).
 */
export async function POST(req: Request) {
  try {
    // Rate limiting: 10 requests por minuto por IP
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.checkUsername);
    if (rateLimitResponse) return rateLimitResponse;

    let body: { username?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const username = body.username;

    // Validar username
    if (!username || typeof username !== "string") {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 },
      );
    }

    const normalizedUsername = normalizeUsername(username);
    const validationError = validateUsername(normalizedUsername);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    if (normalizedUsername.length < 2) {
      return NextResponse.json(
        { error: "Username must be at least 2 characters" },
        { status: 400 },
      );
    }

    if (normalizedUsername.length > 20) {
      return NextResponse.json(
        { error: "Username must be at most 20 characters" },
        { status: 400 },
      );
    }

    // Contar cuántos discriminators ya están usados para este username
    const usedCount = await db.profile.count({
      where: {
        username: { equals: normalizedUsername, mode: "insensitive" },
      },
    });

    // Username agotado: no quedan discriminators
    if (usedCount >= MAX_DISCRIMINATORS) {
      return NextResponse.json({
        available: false,
        sanitized: normalizedUsername,
        error:
          "This username is no longer available. Please choose a different one.",
      });
    }

    // Username disponible
    return NextResponse.json({
      available: true,
      sanitized: normalizedUsername,
      message: "Username is available. A unique identifier will be assigned.",
    });
  } catch (error) {
    console.error("[CHECK_USERNAME_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
