import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const { profile } = auth;

    return NextResponse.json({
      id: profile.id,
      username: profile.username,
      discriminator: profile.discriminator,
      avatarAssetId: profile.avatarAssetId,
      bannerAssetId: profile.bannerAssetId,
      badgeStickerId: profile.badgeStickerId,
      avatarAsset: profile.avatarAsset,
      bannerAsset: profile.bannerAsset,
      badgeSticker: profile.badgeSticker,
      email: profile.email,
      languages: profile.languages,
      usernameColor: profile.usernameColor,
      profileTags: profile.profileTags,
      badge: profile.badge,
      usernameFormat: profile.usernameFormat,
      longDescription: profile.longDescription,
      themeConfig: profile.themeConfig,
    });
  } catch (error) {
    console.error("[PROFILE_ME_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
