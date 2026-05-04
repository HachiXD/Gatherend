import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { UUID_REGEX } from "@/lib/uploaded-assets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  _req: Request,
  context: { params: Promise<{ postId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const { profile } = auth;

    const { postId } = await context.params;
    if (!postId || !UUID_REGEX.test(postId)) {
      return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      const post = await tx.communityPost.findFirst({
        where: { id: postId, deleted: false },
        select: { id: true, likeCount: true },
      });
      if (!post) throw new Error("POST_NOT_FOUND");

      const existing = await tx.communityPostLike.findUnique({
        where: { postId_profileId: { postId, profileId: profile.id } },
        select: { id: true },
      });
      if (existing) throw new Error("ALREADY_LIKED");

      await tx.communityPostLike.create({
        data: { postId, profileId: profile.id },
      });

      const updated = await tx.communityPost.update({
        where: { id: postId },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      });

      return { likeCount: updated.likeCount };
    });

    return NextResponse.json({ likeCount: result.likeCount, isLiked: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "POST_NOT_FOUND") {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }
      if (error.message === "ALREADY_LIKED") {
        return NextResponse.json({ error: "Already liked" }, { status: 409 });
      }
    }
    console.error("[POST_LIKE_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ postId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const { profile } = auth;

    const { postId } = await context.params;
    if (!postId || !UUID_REGEX.test(postId)) {
      return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      const existing = await tx.communityPostLike.findUnique({
        where: { postId_profileId: { postId, profileId: profile.id } },
        select: { id: true },
      });
      if (!existing) throw new Error("NOT_LIKED");

      await tx.communityPostLike.delete({
        where: { postId_profileId: { postId, profileId: profile.id } },
      });

      const updated = await tx.communityPost.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      });

      return { likeCount: Math.max(0, updated.likeCount) };
    });

    return NextResponse.json({ likeCount: result.likeCount, isLiked: false });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_LIKED") {
        return NextResponse.json({ error: "Not liked" }, { status: 404 });
      }
    }
    console.error("[POST_LIKE_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
