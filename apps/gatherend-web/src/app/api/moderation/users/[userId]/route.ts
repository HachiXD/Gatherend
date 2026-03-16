import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { profileCache } from "@/lib/redis";
import { AuthProvider } from "@prisma/client";
import {
  serializeUploadedAsset,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";
import {
  moderationProfileSelect,
  moderationProfileWithUserIdSelect,
  serializeModerationProfile,
} from "@/lib/moderation-serialization";

export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function invalidateProfileCaches(profile: { id: string; userId: string }) {
  // Legacy key (Profile.userId) is still used in some transitional flows.
  await profileCache.invalidate(profile.userId);

  // Also invalidate keys for linked identities (legacy id, betterauth:<userId>).
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
}

async function revokeBetterAuthSessions(profileId: string): Promise<void> {
  const identity = await db.authIdentity.findFirst({
    where: {
      profileId,
      provider: AuthProvider.BETTER_AUTH,
    },
    select: { providerUserId: true },
  });

  if (!identity) {
    return;
  }

  // Revoke all BetterAuth sessions (forces logout).
  await db.session.deleteMany({
    where: { userId: identity.providerUserId },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  // Rate limiting for moderation reads
  const rateLimitResponse = await checkRateLimit(RATE_LIMITS.moderationRead);
  if (rateLimitResponse) return rateLimitResponse;

  const admin = await requireAdmin();
  if (!admin.success) return admin.response;

  const { userId: profileId } = await params;

  // Validate profileId format (UUID)
  if (!profileId || !UUID_REGEX.test(profileId)) {
    return NextResponse.json(
      { error: "Invalid profile ID format" },
      { status: 400 },
    );
  }

  try {
    // Find profile by profileId
    const profile = await db.profile.findUnique({
      where: { id: profileId },
      select: {
        ...moderationProfileWithUserIdSelect,
        banned: true,
        bannedAt: true,
        banReason: true,
        validReports: true,
        falseReports: true,
        reportAccuracy: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get reports filed BY this user
    const reportsFiled = await db.report.findMany({
      where: { reporterId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        targetType: true,
        targetId: true,
        category: true,
        status: true,
        createdAt: true,
      },
    });

    // Get reports filed AGAINST this user
    const reportsAgainst = await db.report.findMany({
      where: { targetOwnerId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        reporter: {
          select: moderationProfileSelect,
        },
      },
    });

    // Get strikes for this user
    const strikes = await db.strike.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Get boards created by this user
    const boardsOwned = await db.board.findMany({
      where: { profileId: profile.id },
      select: {
        id: true,
        name: true,
        imageAsset: {
          select: uploadedAssetSummarySelect,
        },
        reportCount: true,
        hiddenFromFeed: true,
        createdAt: true,
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get recent messages count (through member relationships)
    const members = await db.member.findMany({
      where: { profileId: profile.id },
      select: { id: true },
    });
    const memberIds = members.map((m) => m.id);

    const messageCount =
      memberIds.length > 0
        ? await db.message.count({
            where: { memberId: { in: memberIds } },
          })
        : 0;

    // Calculate statistics
    const stats = {
      totalReportsFiled: reportsFiled.length,
      totalReportsAgainst: reportsAgainst.length,
      totalStrikes: strikes.length,
      activeStrikes: strikes.filter(
        (s) => !s.expiresAt || s.expiresAt > new Date(),
      ).length,
      boardsOwned: boardsOwned.length,
      totalMessages: messageCount,
      accountAge: Math.floor(
        (Date.now() - new Date(profile.createdAt).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    };

    return NextResponse.json({
      profile: serializeModerationProfile(profile),
      reportsFiled,
      reportsAgainst: reportsAgainst.map((report) => ({
        ...report,
        reporter: serializeModerationProfile(report.reporter),
      })),
      strikes,
      boardsOwned: boardsOwned.map((board) => ({
        ...board,
        imageAsset: serializeUploadedAsset(board.imageAsset),
      })),
      stats,
    });
  } catch (error) {
    console.error("[MODERATION_USER_LOOKUP]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST endpoint to take action on a user
export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  // Rate limiting for moderation actions
  const rateLimitResponse = await checkRateLimit(RATE_LIMITS.moderation);
  if (rateLimitResponse) return rateLimitResponse;

  const admin = await requireAdmin();
  if (!admin.success) return admin.response;

  const { userId: profileId } = await params;

  // Validate profileId format (UUID)
  if (!profileId || !UUID_REGEX.test(profileId)) {
    return NextResponse.json(
      { error: "Invalid profile ID format" },
      { status: 400 },
    );
  }

  // Prevent self-moderation
  if (profileId === admin.profile.id) {
    return NextResponse.json(
      { error: "Cannot perform moderation actions on yourself" },
      { status: 400 },
    );
  }

  try {
    // Safe body parsing
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { action, reason } = body as {
      action: "ban" | "unban" | "clearStrikes";
      reason?: string;
    };

    // Validate action type early
    const VALID_ACTIONS = ["ban", "unban", "clearStrikes"] as const;
    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Validate reason if provided
    if (reason !== undefined) {
      if (typeof reason !== "string") {
        return NextResponse.json(
          { error: "Reason must be a string" },
          { status: 400 },
        );
      }
      if (reason.length > 500) {
        return NextResponse.json(
          { error: "Reason too long (max 500 characters)" },
          { status: 400 },
        );
      }
    }

    const profile = await db.profile.findUnique({ where: { id: profileId } });

    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    switch (action) {
      case "ban":
        // Check if already banned
        if (profile.banned) {
          return NextResponse.json(
            { error: "User is already banned", alreadyBanned: true },
            { status: 409 },
          );
        }

        await db.profile.update({
          where: { id: profile.id },
          data: {
            banned: true,
            bannedAt: new Date(),
            banReason: reason || "Banned by moderator",
          },
        });

        // Invalidate profile caches immediately and revoke BetterAuth sessions.
        await invalidateProfileCaches(profile);
        await revokeBetterAuthSessions(profile.id);
        break;

      case "unban":
        // Check if already unbanned
        if (!profile.banned) {
          return NextResponse.json(
            { error: "User is not banned", alreadyUnbanned: true },
            { status: 409 },
          );
        }

        await db.profile.update({
          where: { id: profile.id },
          data: {
            banned: false,
            bannedAt: null,
            banReason: null,
          },
        });

        // Invalidate profile caches immediately (DB is the source of truth).
        await invalidateProfileCaches(profile);
        break;

      case "clearStrikes":
        await db.strike.deleteMany({
          where: { profileId: profile.id },
        });
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[MODERATION_USER_ACTION]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
