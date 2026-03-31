import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { ReportTargetType } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  moderationProfileSelect,
  moderationProfileWithUserIdSelect,
  serializeModerationProfile,
} from "@/lib/moderation-serialization";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  // Rate limiting
  const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
  if (rateLimitResponse) return rateLimitResponse;

  const admin = await requireAdmin();
  if (!admin.success) return admin.response;

  try {
    const { reportId } = await params;

    // Validate UUID
    if (!reportId || !UUID_REGEX.test(reportId)) {
      return NextResponse.json({ error: "Invalid report ID" }, { status: 400 });
    }

    const report = await db.report.findUnique({
      where: { id: reportId },
      include: {
        reporter: {
          select: moderationProfileSelect,
        },
        targetOwner: {
          select: moderationProfileWithUserIdSelect,
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Build response based on target type
    let additionalContext: Record<string, unknown> = {};

    // BOARD: Get current members
    if (report.targetType === ReportTargetType.BOARD) {
      const board = await db.board.findUnique({
        where: { id: report.targetId },
        include: {
          members: {
            include: {
              profile: {
                select: moderationProfileSelect,
              },
            },
          },
        },
      });

      if (board) {
        additionalContext.boardMembers = board.members.map((m) => ({
          id: m.id,
          role: m.role,
          profile: serializeModerationProfile(m.profile),
        }));
      }
    }

    if (report.targetType === ReportTargetType.COMMUNITY_POST) {
      const post = await db.communityPost.findUnique({
        where: { id: report.targetId },
        select: {
          id: true,
          content: true,
          deleted: true,
          createdAt: true,
          board: {
            select: {
              id: true,
              name: true,
            },
          },
          author: {
            select: moderationProfileSelect,
          },
        },
      });

      if (post) {
        additionalContext.communityPost = {
          id: post.id,
          content: post.content,
          deleted: post.deleted,
          createdAt: post.createdAt.toISOString(),
          board: post.board,
          author: serializeModerationProfile(post.author),
        };
      }
    }

    // COMMENT OF POST
    if (report.targetType === ReportTargetType.COMMUNITY_POST_COMMENT) {
      const comment = await db.communityPostComment.findUnique({
        where: { id: report.targetId },
        select: {
          id: true,
          content: true,
          deleted: true,
          createdAt: true,
          post: {
            select: {
              id: true,
              content: true,
              board: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          author: {
            select: moderationProfileSelect,
          },
          replyToComment: {
            select: {
              id: true,
              content: true,
              deleted: true,
              author: {
                select: moderationProfileSelect,
              },
            },
          },
        },
      });

      if (comment) {
        additionalContext.communityPostComment = {
          id: comment.id,
          content: comment.content,
          deleted: comment.deleted,
          createdAt: comment.createdAt.toISOString(),
          post: {
            id: comment.post.id,
            content: comment.post.content,
            board: comment.post.board,
          },
          author: serializeModerationProfile(comment.author),
          replyToComment: comment.replyToComment
            ? {
                id: comment.replyToComment.id,
                content: comment.replyToComment.content,
                deleted: comment.replyToComment.deleted,
                author: serializeModerationProfile(
                  comment.replyToComment.author,
                ),
              }
            : null,
        };
      }
    }

    // MESSAGE: Get surrounding messages (±10)
    if (report.targetType === ReportTargetType.MESSAGE) {
      const reportedMessage = await db.message.findUnique({
        where: { id: report.targetId },
        select: { channelId: true, createdAt: true },
      });

      if (reportedMessage) {
        // Get messages before
        const messagesBefore = await db.message.findMany({
          where: {
            channelId: reportedMessage.channelId,
            createdAt: { lt: reportedMessage.createdAt },
            deleted: false,
          },
          include: {
            messageSender: {
              select: moderationProfileSelect,
            },
            member: {
              include: {
                profile: {
                  select: moderationProfileSelect,
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        });

        // Get messages after
        const messagesAfter = await db.message.findMany({
          where: {
            channelId: reportedMessage.channelId,
            createdAt: { gt: reportedMessage.createdAt },
            deleted: false,
          },
          include: {
            messageSender: {
              select: moderationProfileSelect,
            },
            member: {
              include: {
                profile: {
                  select: moderationProfileSelect,
                },
              },
            },
          },
          orderBy: { createdAt: "asc" },
          take: 10,
        });

        // Get the reported message itself (current state)
        const currentMessage = await db.message.findUnique({
          where: { id: report.targetId },
          include: {
            messageSender: {
              select: moderationProfileSelect,
            },
            member: {
              include: {
                profile: {
                  select: moderationProfileSelect,
                },
              },
            },
          },
        });

        // Combine and sort
        const allMessages = [
          ...messagesBefore.reverse(),
          ...(currentMessage ? [currentMessage] : []),
          ...messagesAfter,
        ];

        additionalContext.messageContext = allMessages.map((msg) => ({
          id: msg.id,
          content: msg.content,
          createdAt: msg.createdAt.toISOString(),
          messageSender: serializeModerationProfile(msg.messageSender ?? null),
          member: msg.messageSender || msg.member
            ? {
                profile: serializeModerationProfile(
                  msg.messageSender ?? msg.member?.profile ?? null,
                ),
              }
            : null,
          isReported: msg.id === report.targetId,
        }));
      }
    }

    // DIRECT_MESSAGE: Get surrounding DMs (±10)
    if (report.targetType === ReportTargetType.DIRECT_MESSAGE) {
      const reportedDM = await db.directMessage.findUnique({
        where: { id: report.targetId },
        select: { conversationId: true, createdAt: true },
      });

      if (reportedDM) {
        // Get messages before
        const dmsBefore = await db.directMessage.findMany({
          where: {
            conversationId: reportedDM.conversationId,
            createdAt: { lt: reportedDM.createdAt },
          },
          include: {
            sender: {
              select: moderationProfileSelect,
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        });

        // Get messages after
        const dmsAfter = await db.directMessage.findMany({
          where: {
            conversationId: reportedDM.conversationId,
            createdAt: { gt: reportedDM.createdAt },
          },
          include: {
            sender: {
              select: moderationProfileSelect,
            },
          },
          orderBy: { createdAt: "asc" },
          take: 10,
        });

        // Get the reported DM itself
        const currentDM = await db.directMessage.findUnique({
          where: { id: report.targetId },
          include: {
            sender: {
              select: moderationProfileSelect,
            },
          },
        });

        // Combine and sort
        const allDMs = [
          ...dmsBefore.reverse(),
          ...(currentDM ? [currentDM] : []),
          ...dmsAfter,
        ];

        additionalContext.messageContext = allDMs.map((dm) => ({
          id: dm.id,
          content: dm.content,
          createdAt: dm.createdAt.toISOString(),
          member: {
            profile: serializeModerationProfile(dm.sender),
          },
          isReported: dm.id === report.targetId,
        }));
      }
    }

    return NextResponse.json({
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      category: report.category,
      status: report.status,
      priority: report.priority,
      description: report.description,
      createdAt: report.createdAt.toISOString(),
      reporter: serializeModerationProfile(report.reporter),
      targetOwner: serializeModerationProfile(report.targetOwner),
      snapshot: report.snapshot as Record<string, unknown>,
      ...additionalContext,
    });
  } catch (error) {
    console.error("[MODERATION_REPORT_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
