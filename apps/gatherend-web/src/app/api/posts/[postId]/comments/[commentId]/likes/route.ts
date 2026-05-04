import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { UUID_REGEX } from "@/lib/uploaded-assets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  _req: Request,
  context: { params: Promise<{ postId: string; commentId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const { profile } = auth;

    const { postId, commentId } = await context.params;
    if (!postId || !UUID_REGEX.test(postId)) {
      return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
    }
    if (!commentId || !UUID_REGEX.test(commentId)) {
      return NextResponse.json(
        { error: "Invalid comment ID" },
        { status: 400 },
      );
    }

    const result = await db.$transaction(async (tx) => {
      const comment = await tx.communityPostComment.findFirst({
        where: { id: commentId, postId, deleted: false },
        select: { id: true, likeCount: true },
      });
      if (!comment) throw new Error("COMMENT_NOT_FOUND");

      const existing = await tx.communityPostCommentLike.findUnique({
        where: { commentId_profileId: { commentId, profileId: profile.id } },
        select: { id: true },
      });
      if (existing) throw new Error("ALREADY_LIKED");

      await tx.communityPostCommentLike.create({
        data: { commentId, profileId: profile.id },
      });

      const updated = await tx.communityPostComment.update({
        where: { id: commentId },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      });

      return { likeCount: updated.likeCount };
    });

    return NextResponse.json({ likeCount: result.likeCount, isLiked: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "COMMENT_NOT_FOUND") {
        return NextResponse.json(
          { error: "Comment not found" },
          { status: 404 },
        );
      }
      if (error.message === "ALREADY_LIKED") {
        return NextResponse.json({ error: "Already liked" }, { status: 409 });
      }
    }
    console.error("[COMMENT_LIKE_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ postId: string; commentId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const { profile } = auth;

    const { postId, commentId } = await context.params;
    if (!postId || !UUID_REGEX.test(postId)) {
      return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
    }
    if (!commentId || !UUID_REGEX.test(commentId)) {
      return NextResponse.json(
        { error: "Invalid comment ID" },
        { status: 400 },
      );
    }

    const result = await db.$transaction(async (tx) => {
      const existing = await tx.communityPostCommentLike.findUnique({
        where: { commentId_profileId: { commentId, profileId: profile.id } },
        select: { id: true },
      });
      if (!existing) throw new Error("NOT_LIKED");

      await tx.communityPostCommentLike.delete({
        where: { commentId_profileId: { commentId, profileId: profile.id } },
      });

      const updated = await tx.communityPostComment.update({
        where: { id: commentId },
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
    console.error("[COMMENT_LIKE_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
