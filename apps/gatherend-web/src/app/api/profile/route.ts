import { requireAuth } from "@/lib/require-auth";
import { db } from "@/lib/db";
import { AuthProvider, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { profileCache } from "@/lib/redis";
import { generateProfileAvatarUrl } from "@/lib/avatar-utils";
import { v4 as uuidv4 } from "uuid";
import { generateUniqueDiscriminator } from "@/lib/username";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

async function emitProfileUpdated(
  profileId: string,
  patch: Record<string, unknown>,
) {
  try {
    const socketUrl =
      process.env.SOCKET_SERVER_URL || process.env.NEXT_PUBLIC_SOCKET_URL;
    const secret = process.env.INTERNAL_API_SECRET;

    // Skip if socket URL or secret is not configured
    if (!socketUrl || !secret) return;

    // Fire-and-forget - never block profile changes on sockets
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

export async function GET() {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const { profile } = auth;

    return NextResponse.json(profile);
  } catch (error) {
    console.error("[PROFILE_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    // requireAuth checks both authentication AND ban status
    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    // Parse body with error handling
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const {
      username,
      imageUrl,
      languages,
      usernameColor,
      profileTags,
      badge,
      badgeStickerUrl,
      usernameFormat,
      longDescription,
    } = body;

    // No permitir actualizar username sin discriminator válido
    if (username !== undefined && !profile.discriminator) {
      return NextResponse.json(
        { error: "Profile missing discriminator, cannot update username" },
        { status: 400 },
      );
    }

    // Validate usernameColor format (solid color or gradient)
    if (usernameColor !== undefined && usernameColor !== null) {
      const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

      if (typeof usernameColor === "object") {
        if (usernameColor.type === "solid") {
          if (!hexColorRegex.test(usernameColor.color)) {
            return NextResponse.json(
              { error: "Invalid solid color format" },
              { status: 400 },
            );
          }
        } else if (usernameColor.type === "gradient") {
          // Validate gradient with color stops
          if (
            !Array.isArray(usernameColor.colors) ||
            usernameColor.colors.length < 2 ||
            usernameColor.colors.length > 4
          ) {
            return NextResponse.json(
              { error: "Gradient must have 2-4 color stops" },
              { status: 400 },
            );
          }
          for (const colorStop of usernameColor.colors) {
            if (
              typeof colorStop !== "object" ||
              !colorStop.color ||
              typeof colorStop.position !== "number"
            ) {
              return NextResponse.json(
                { error: "Invalid color stop format" },
                { status: 400 },
              );
            }
            if (!hexColorRegex.test(colorStop.color)) {
              return NextResponse.json(
                { error: "Invalid gradient color format" },
                { status: 400 },
              );
            }
            if (colorStop.position < 0 || colorStop.position > 100) {
              return NextResponse.json(
                { error: "Color position must be 0-100" },
                { status: 400 },
              );
            }
          }
          if (
            typeof usernameColor.angle !== "number" ||
            usernameColor.angle < 0 ||
            usernameColor.angle > 360
          ) {
            return NextResponse.json(
              { error: "Gradient angle must be 0-360" },
              { status: 400 },
            );
          }
          if (
            usernameColor.animationType &&
            !["shift", "shimmer", "pulse"].includes(usernameColor.animationType)
          ) {
            return NextResponse.json(
              { error: "Invalid animation type" },
              { status: 400 },
            );
          }
        } else {
          return NextResponse.json(
            { error: "Invalid usernameColor type" },
            { status: 400 },
          );
        }
      } else {
        return NextResponse.json(
          { error: "Invalid usernameColor format" },
          { status: 400 },
        );
      }
    }

    // Validate profileTags
    if (profileTags !== undefined && profileTags !== null) {
      if (!Array.isArray(profileTags)) {
        return NextResponse.json(
          { error: "Profile tags must be an array" },
          { status: 400 },
        );
      }
      if (profileTags.length > 10) {
        return NextResponse.json(
          { error: "Maximum 10 profile tags allowed" },
          { status: 400 },
        );
      }
      for (const tag of profileTags) {
        if (typeof tag !== "string" || tag.length > 10 || tag.length < 1) {
          return NextResponse.json(
            { error: "Each tag must be 1-10 characters" },
            { status: 400 },
          );
        }
        // Only allow alphanumeric, spaces, and some special chars
        if (!/^[a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s\-_]+$/.test(tag)) {
          return NextResponse.json(
            {
              error:
                "Tags can only contain letters, numbers, spaces, and hyphens",
            },
            { status: 400 },
          );
        }
      }
    }

    // Validate badge length
    if (badge !== undefined && badge !== null && badge.length > 30) {
      return NextResponse.json(
        { error: "Badge must be 30 characters or less" },
        { status: 400 },
      );
    }

    // Validate badgeStickerUrl (should be a valid URL if provided)
    if (
      badgeStickerUrl !== undefined &&
      badgeStickerUrl !== null &&
      badgeStickerUrl !== ""
    ) {
      try {
        new URL(badgeStickerUrl);
      } catch {
        return NextResponse.json(
          { error: "Invalid badge sticker URL" },
          { status: 400 },
        );
      }
    }

    // Validate longDescription length
    if (
      longDescription !== undefined &&
      longDescription !== null &&
      longDescription.length > 200
    ) {
      return NextResponse.json(
        { error: "Description must be 200 characters or less" },
        { status: 400 },
      );
    }

    // Validate usernameFormat (now JSON: { bold?: boolean, italic?: boolean, underline?: boolean })
    if (usernameFormat !== undefined && usernameFormat !== null) {
      if (typeof usernameFormat !== "object") {
        return NextResponse.json(
          { error: "Invalid username format - must be an object" },
          { status: 400 },
        );
      }
      const { bold, italic, underline } = usernameFormat;
      if (bold !== undefined && typeof bold !== "boolean") {
        return NextResponse.json(
          { error: "Invalid username format - bold must be boolean" },
          { status: 400 },
        );
      }
      if (italic !== undefined && typeof italic !== "boolean") {
        return NextResponse.json(
          { error: "Invalid username format - italic must be boolean" },
          { status: 400 },
        );
      }
      if (underline !== undefined && typeof underline !== "boolean") {
        return NextResponse.json(
          { error: "Invalid username format - underline must be boolean" },
          { status: 400 },
        );
      }
    }

    const updatedProfile = await db.profile.update({
      where: { id: profile.id },
      data: {
        username,
        imageUrl,
        languages,
        usernameColor,
        profileTags,
        badge,
        badgeStickerUrl: badgeStickerUrl || null,
        usernameFormat,
        longDescription,
      },
    });

    // Invalidate Redis cache keys for this profile so reloads reflect changes.
    // currentProfile caches by provider identity (legacy id, betterauth:<userId>).
    await profileCache.invalidate(profile.userId);
    await profileCache.invalidate(`betterauth:${profile.userId}`);

    const identities = await db.authIdentity.findMany({
      where: { profileId: profile.id },
      select: { provider: true, providerUserId: true },
    });

    for (const identity of identities) {
      const cacheKey =
        identity.provider === AuthProvider.BETTER_AUTH
          ? `betterauth:${identity.providerUserId}`
          : identity.providerUserId;
      await profileCache.invalidate(cacheKey);
    }

    emitProfileUpdated(profile.id, {
      username: updatedProfile.username,
      discriminator: updatedProfile.discriminator,
      imageUrl: updatedProfile.imageUrl,
      usernameColor: updatedProfile.usernameColor,
      usernameFormat: updatedProfile.usernameFormat,
      badge: updatedProfile.badge,
      badgeStickerUrl: updatedProfile.badgeStickerUrl,
      longDescription: updatedProfile.longDescription,
    });

    return NextResponse.json(updatedProfile);
  } catch (error) {
    console.error("[PROFILE_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

/**
 * DELETE /api/profile
 *
 * Soft delete: Anonymizes the profile instead of deleting it.
 * - Replaces username with "Deleted_User_{shortId}"
 * - Clears all personal information (email, description, etc.)
 * - Generates a generic avatar
 * - Deletes the auth user (frees the email for re-registration)
 * - Invalidates Redis cache
 *
 * All related data (messages, memberships, etc.) remains intact
 * but points to an anonymized profile.
 */
export async function DELETE() {
  try {
    // Rate limiting - strict for destructive action
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.moderation);
    if (rateLimitResponse) return rateLimitResponse;

    // requireAuth checks both authentication AND ban status
    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    // Generate anonymized data
    const shortId = uuidv4().slice(0, 8);
    const anonymizedUsername = `Deleted_User_${shortId}`;

    // Generate a unique discriminator for the anonymized username
    const anonymizedDiscriminator =
      await generateUniqueDiscriminator(anonymizedUsername);

    // Generate a generic avatar based on the anonymized username
    const anonymizedImageUrl =
      generateProfileAvatarUrl(anonymizedUsername) ?? "";

    // Anonymize the profile in database
    const deletedProfile = await db.profile.update({
      where: { id: profile.id },
      data: {
        // Identity
        username: anonymizedUsername,
        discriminator: anonymizedDiscriminator,
        imageUrl: anonymizedImageUrl,
        email: "", // Clear email (required field, use empty string)

        // Customization - clear all (use Prisma.JsonNull for nullable JSON fields)
        usernameColor: Prisma.JsonNull,
        profileTags: [],
        badge: null,
        badgeStickerUrl: null,
        usernameFormat: Prisma.JsonNull,
        longDescription: null,
        themeConfig: Prisma.JsonNull,

        // Languages - reset to default
        languages: ["EN"],

        // Reporter reputation - reset
        reportAccuracy: null,
        falseReports: 0,
        validReports: 0,

        // Note: banned, bannedAt, banReason are preserved for moderation history
      },
    });

    emitProfileUpdated(profile.id, {
      username: deletedProfile.username,
      discriminator: deletedProfile.discriminator,
      imageUrl: deletedProfile.imageUrl,
      usernameColor: deletedProfile.usernameColor,
      usernameFormat: deletedProfile.usernameFormat,
      badge: deletedProfile.badge,
      badgeStickerUrl: deletedProfile.badgeStickerUrl,
      longDescription: deletedProfile.longDescription,
    });

    // Invalidate Redis cache keys for this profile.
    // currentProfile caches by provider identity (legacy id, betterauth:<userId>).
    await profileCache.invalidate(profile.userId);

    const identities = await db.authIdentity.findMany({
      where: { profileId: profile.id },
      select: { provider: true, providerUserId: true },
    });

    for (const identity of identities) {
      const cacheKey =
        identity.provider === AuthProvider.BETTER_AUTH
          ? `betterauth:${identity.providerUserId}`
          : identity.providerUserId;
      await profileCache.invalidate(cacheKey);
    }

    // BetterAuth hardening: revoke sessions + delete auth user (frees email reuse),
    // without depending on third-party provider APIs.
    const betterAuthIdentity = identities.find(
      (i) => i.provider === AuthProvider.BETTER_AUTH,
    );
    if (betterAuthIdentity) {
      await db.session.deleteMany({
        where: { userId: betterAuthIdentity.providerUserId },
      });
      await db.user
        .delete({
          where: { id: betterAuthIdentity.providerUserId },
        })
        .catch(() => null);
      await db.authIdentity
        .deleteMany({
          where: {
            profileId: profile.id,
            provider: AuthProvider.BETTER_AUTH,
          },
        })
        .catch(() => null);
    }

    return NextResponse.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("[PROFILE_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
