import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  moderationProfileWithUserIdSelect,
  serializeModerationProfile,
} from "@/lib/moderation-serialization";

export const dynamic = "force-dynamic";

// Search for users by username/discriminator or partial username
export async function GET(req: Request) {
  // Rate limiting
  const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
  if (rateLimitResponse) return rateLimitResponse;

  const admin = await requireAdmin();
  if (!admin.success) return admin.response;

  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim();

    if (!query) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 },
      );
    }

    // Check if query contains / (exact match with discriminator)
    if (query.includes("/")) {
      const [username, discriminator] = query.split("/");

      if (!username || !discriminator) {
        return NextResponse.json(
          { error: "Invalid format. Use username/1234" },
          { status: 400 },
        );
      }

      const profile = await db.profile.findFirst({
        where: {
          username: { equals: username, mode: "insensitive" },
          discriminator: discriminator,
        },
        select: {
          ...moderationProfileWithUserIdSelect,
          banned: true,
          bannedAt: true,
          banReason: true,
          createdAt: true,
        },
      });

      if (!profile) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      return NextResponse.json({
        profiles: [serializeModerationProfile(profile)],
        exact: true,
      });
    }

    // Partial search by username (returns multiple results)
    const profiles = await db.profile.findMany({
      where: {
        username: { contains: query, mode: "insensitive" },
      },
      select: {
        ...moderationProfileWithUserIdSelect,
        banned: true,
        bannedAt: true,
        banReason: true,
        createdAt: true,
      },
      orderBy: [
        { banned: "desc" }, // Show banned users first
        { username: "asc" },
      ],
      take: 20,
    });

    return NextResponse.json({
      profiles: profiles.map(serializeModerationProfile),
      exact: false,
    });
  } catch (error) {
    console.error("[MODERATION_LOOKUP]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
