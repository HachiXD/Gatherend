import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { AuthProvider, Prisma } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { profileCache } from "@/lib/redis";
import { normalizeThemeGradientColors } from "@/lib/theme/gradient-stops";
import type { GradientConfig } from "@/lib/theme/types";

async function emitProfileUpdated(profileId: string, patch: Record<string, unknown>) {
  try {
    const socketUrl =
      process.env.SOCKET_SERVER_URL || process.env.NEXT_PUBLIC_SOCKET_URL;
    const secret = process.env.INTERNAL_API_SECRET;

    // Skip if socket URL or secret is not configured
    if (!socketUrl || !secret) return;

    fetch(`${socketUrl}/emit-to-room`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": secret,
      },
      body: JSON.stringify({
        room: `profile-watch:${profileId}`,
        event: "profile:updated",
        data: { profileId, patch, timestamp: Date.now() },
      }),
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);
  } catch {
    // noop
  }
}

// Validate hex color format
function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

// Validate a gradient color item (string or GradientColorStop object)
function isValidGradientColorItem(item: unknown): boolean {
  // String format (legacy)
  if (typeof item === "string") {
    return isValidHexColor(item);
  }

  // GradientColorStop object format
  if (item && typeof item === "object") {
    const stop = item as Record<string, unknown>;
    return (
      typeof stop.color === "string" &&
      isValidHexColor(stop.color) &&
      typeof stop.position === "number" &&
      stop.position >= 0 &&
      stop.position <= 100
    );
  }

  return false;
}

// Validate gradient config
function isValidGradientConfig(gradient: unknown): boolean {
  if (!gradient || typeof gradient !== "object") return false;

  const g = gradient as Record<string, unknown>;

  // Validate colors array (accepts both string[] and GradientColorStop[])
  if (!Array.isArray(g.colors)) return false;
  if (g.colors.length < 2 || g.colors.length > 4) return false;
  if (!g.colors.every(isValidGradientColorItem)) {
    return false;
  }

  // Validate angle
  if (typeof g.angle !== "number" || g.angle < 0 || g.angle > 360) return false;

  // Validate type
  if (g.type !== "linear" && g.type !== "radial") return false;

  return true;
}

export async function PATCH(req: Request) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const { profile } = auth;

    // Parse body with error handling
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { baseColor, gradient, mode } = body;

    // Build themeConfig object
    const themeConfig: Record<string, unknown> = {};

    // Validate and add baseColor if provided
    if (baseColor !== undefined) {
      if (baseColor === null) {
        // Allow null to reset to default
        // themeConfig will be empty or just have gradient
      } else if (typeof baseColor === "string" && isValidHexColor(baseColor)) {
        themeConfig.baseColor = baseColor;
      } else {
        return NextResponse.json(
          { error: "Invalid base color format" },
          { status: 400 },
        );
      }
    }

    // Validate and add mode if provided
    if (mode !== undefined) {
      if (mode === null) {
        // Allow null to reset to default (dark)
      } else if (mode === "dark" || mode === "light") {
        themeConfig.mode = mode;
      } else {
        return NextResponse.json(
          { error: "Invalid mode value" },
          { status: 400 },
        );
      }
    }

    // Validate and add gradient if provided
    if (gradient !== undefined) {
      if (gradient === null) {
        // Allow null to remove gradient
        // themeConfig will not have gradient
      } else if (isValidGradientConfig(gradient)) {
        const normalizedGradient = gradient as GradientConfig;
        themeConfig.gradient = {
          ...normalizedGradient,
          colors: normalizeThemeGradientColors(normalizedGradient.colors),
        };
      } else {
        return NextResponse.json(
          { error: "Invalid gradient configuration" },
          { status: 400 },
        );
      }
    }

    // Update profile with new themeConfig
    const updatedProfile = await db.profile.update({
      where: { id: profile.id },
      data: {
        themeConfig:
          Object.keys(themeConfig).length > 0
            ? (themeConfig as Prisma.InputJsonValue)
            : Prisma.DbNull,
      },
    });

    // currentProfile() reads cache by identity key (betterauth:<userId>).
    // Write-through both canonical and legacy keys to avoid stale profile on reload.
    const cachedProfile = {
      ...profile,
      themeConfig: updatedProfile.themeConfig,
      updatedAt: updatedProfile.updatedAt,
    };

    await profileCache.set(profile.userId, cachedProfile);
    await profileCache.set(`betterauth:${profile.userId}`, cachedProfile);

    const identities = await db.authIdentity.findMany({
      where: { profileId: profile.id },
      select: { provider: true, providerUserId: true },
    });

    for (const identity of identities) {
      const cacheKey =
        identity.provider === AuthProvider.BETTER_AUTH
          ? `betterauth:${identity.providerUserId}`
          : identity.providerUserId;
      await profileCache.set(cacheKey, cachedProfile);
    }

    emitProfileUpdated(profile.id, {
      themeConfig: updatedProfile.themeConfig,
      updatedAt: updatedProfile.updatedAt,
    });

    return NextResponse.json(updatedProfile);
  } catch (error) {
    console.error("[PROFILE_THEME_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const { profile } = auth;

    return NextResponse.json({
      themeConfig: profile.themeConfig,
    });
  } catch (error) {
    console.error("[PROFILE_THEME_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
