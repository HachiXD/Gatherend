import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import {
  serializeProfileSummary,
  serializeUploadedAsset,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// No cachear - el feed cambia con nuevos posts y acciones de moderacion
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 10;
const MAX_LIMIT = 50;
const MAX_CURSOR_LENGTH = 128;

interface CommunityMetadata {
  id: string;
  name: string;
  imageAsset: ReturnType<typeof serializeUploadedAsset>;
  memberCount: number;
  recentPostCount7d: number;
}

interface CommunityPostFeedItem {
  id: string;
  title: string;
  content: string;
  imageAsset: ReturnType<typeof serializeUploadedAsset>;
  commentCount: number;
  latestComments: Array<{
    id: string;
    postId: string;
    content: string;
    deleted: boolean;
    imageAsset: ReturnType<typeof serializeUploadedAsset>;
    createdAt: string;
    updatedAt: string;
    author: ReturnType<typeof serializeProfileSummary>;
    replyToCommentId: string | null;
    replyToComment: {
      id: string;
      content: string;
      deleted: boolean;
      createdAt: string;
      author: {
        id: string;
        username: string;
        discriminator: string | null;
      };
    } | null;
  }>;
  createdAt: string;
  updatedAt: string;
  pinnedAt: string | null;
  lockedAt: string | null;
  author: ReturnType<typeof serializeProfileSummary>;
}

function serializeCommentPreview(comment: {
  id: string;
  postId: string;
  content: string;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  imageAsset: {
    id: string;
    key: string;
    visibility: import("@prisma/client").AssetVisibility;
    context: import("@prisma/client").AssetContext;
    mimeType: string;
    sizeBytes: number | null;
    width: number | null;
    height: number | null;
    originalName: string | null;
    dominantColor: string | null;
  } | null;
  author: {
    id: string;
    username: string;
    discriminator: string | null;
    badge: string | null;
    usernameColor: import("@prisma/client").Prisma.JsonValue | null;
    usernameFormat: import("@prisma/client").Prisma.JsonValue | null;
    profileTags: string[];
    avatarAsset: {
      id: string;
      key: string;
      visibility: import("@prisma/client").AssetVisibility;
      context: import("@prisma/client").AssetContext;
      mimeType: string;
      sizeBytes: number | null;
      width: number | null;
      height: number | null;
      originalName: string | null;
      dominantColor: string | null;
    } | null;
    badgeSticker: {
      id: string;
      asset: {
        id: string;
        key: string;
        visibility: import("@prisma/client").AssetVisibility;
        context: import("@prisma/client").AssetContext;
        mimeType: string;
        sizeBytes: number | null;
        width: number | null;
        height: number | null;
        originalName: string | null;
        dominantColor: string | null;
      } | null;
    } | null;
  };
  replyToCommentId: string | null;
  replyToComment: {
    id: string;
    content: string;
    deleted: boolean;
    createdAt: Date;
    author: {
      id: string;
      username: string;
      discriminator: string | null;
    };
  } | null;
}) {
  return {
    id: comment.id,
    postId: comment.postId,
    content: comment.content,
    deleted: comment.deleted,
    imageAsset: serializeUploadedAsset(comment.imageAsset),
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    author: serializeProfileSummary(comment.author),
    replyToCommentId: comment.replyToCommentId,
    replyToComment: comment.replyToComment
      ? {
          id: comment.replyToComment.id,
          content: comment.replyToComment.content,
          deleted: comment.replyToComment.deleted,
          createdAt: comment.replyToComment.createdAt.toISOString(),
          author: comment.replyToComment.author,
        }
      : null,
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ communityId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;

    const { communityId } = await params;
    const { searchParams } = new URL(req.url);

    if (!communityId || !UUID_REGEX.test(communityId)) {
      return NextResponse.json(
        { error: "Invalid community ID" },
        { status: 400 },
      );
    }

    const cursorParam = searchParams.get("cursor");
    const limitParam = parseInt(
      searchParams.get("limit") || String(PAGE_SIZE),
      10,
    );
    const limit = Math.min(
      Number.isNaN(limitParam) ? PAGE_SIZE : limitParam,
      MAX_LIMIT,
    );
    const isFirstPage = !cursorParam;

    let cursorCreatedAt: Date | null = null;
    let cursorId: string | null = null;

    if (cursorParam) {
      if (cursorParam.length > MAX_CURSOR_LENGTH) {
        return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
      }

      const [createdAtStr, id] = cursorParam.split("|");

      if (!createdAtStr || !id || !UUID_REGEX.test(id)) {
        return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
      }

      const parsedCreatedAt = new Date(createdAtStr);
      if (Number.isNaN(parsedCreatedAt.getTime())) {
        return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
      }

      cursorCreatedAt = parsedCreatedAt;
      cursorId = id;
    }

    let communityMetadata: CommunityMetadata | null = null;

    if (isFirstPage) {
      const community = await db.community.findUnique({
        where: { id: communityId },
        select: {
          id: true,
          name: true,
          memberCount: true,
          recentPostCount7d: true,
          imageAsset: {
            select: uploadedAssetSummarySelect,
          },
        },
      });

      if (!community) {
        return NextResponse.json(
          { error: "Community not found" },
          { status: 404 },
        );
      }

      communityMetadata = {
        id: community.id,
        name: community.name,
        imageAsset: serializeUploadedAsset(community.imageAsset),
        memberCount: community.memberCount,
        recentPostCount7d: community.recentPostCount7d,
      };
    } else {
      const communityExists = await db.community.findUnique({
        where: { id: communityId },
        select: { id: true },
      });

      if (!communityExists) {
        return NextResponse.json(
          { error: "Community not found" },
          { status: 404 },
        );
      }
    }

    const posts = await db.communityPost.findMany({
      where: {
        communityId,
        deleted: false,
        ...(cursorCreatedAt && cursorId
          ? {
              OR: [
                { createdAt: { lt: cursorCreatedAt } },
                {
                  AND: [{ createdAt: cursorCreatedAt }, { id: { lt: cursorId } }],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: {
        id: true,
        title: true,
        content: true,
        commentCount: true,
        imageAsset: {
          select: uploadedAssetSummarySelect,
        },
        createdAt: true,
        updatedAt: true,
        pinnedAt: true,
        lockedAt: true,
        author: {
          select: {
            id: true,
            username: true,
            discriminator: true,
            badge: true,
            usernameColor: true,
            usernameFormat: true,
            profileTags: true,
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
          },
        },
        comments: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 5,
          select: {
            id: true,
            postId: true,
            content: true,
            deleted: true,
            createdAt: true,
            updatedAt: true,
            imageAsset: {
              select: uploadedAssetSummarySelect,
            },
            author: {
              select: {
                id: true,
                username: true,
                discriminator: true,
                badge: true,
                usernameColor: true,
                usernameFormat: true,
                profileTags: true,
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
              },
            },
            replyToCommentId: true,
            replyToComment: {
              select: {
                id: true,
                content: true,
                deleted: true,
                createdAt: true,
                author: {
                  select: {
                    id: true,
                    username: true,
                    discriminator: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;

    const result: CommunityPostFeedItem[] = items.map((post) => ({
      id: post.id,
      title: post.title,
      content: post.content,
      imageAsset: serializeUploadedAsset(post.imageAsset),
      commentCount: post.commentCount,
      latestComments: [...post.comments]
        .reverse()
        .map(serializeCommentPreview),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      pinnedAt: post.pinnedAt?.toISOString() ?? null,
      lockedAt: post.lockedAt?.toISOString() ?? null,
      author: serializeProfileSummary(post.author),
    }));

    const lastItem = items.length > 0 ? items[items.length - 1] : null;
    const nextCursor =
      hasMore && lastItem
        ? `${lastItem.createdAt.toISOString()}|${lastItem.id}`
        : null;

    return NextResponse.json({
      items: result,
      nextCursor,
      hasMore,
      ...(communityMetadata && { community: communityMetadata }),
    });
  } catch (error) {
    console.error("[DISCOVERY_COMMUNITY_POSTS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
