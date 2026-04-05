import { ReportTargetType } from "@prisma/client";
import { db } from "@/lib/db";
import {
  moderationProfileSelect,
  serializeModerationProfile,
} from "@/lib/moderation-serialization";

export async function loadMessageContextForReport(targetId: string) {
  const reportedMessage = await db.message.findUnique({
    where: { id: targetId },
    select: { channelId: true, createdAt: true },
  });

  if (!reportedMessage) {
    return [];
  }

  const [messagesBefore, messagesAfter, currentMessage] = await Promise.all([
    db.message.findMany({
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
    }),
    db.message.findMany({
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
    }),
    db.message.findUnique({
      where: { id: targetId },
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
    }),
  ]);

  const allMessages = [
    ...messagesBefore.reverse(),
    ...(currentMessage ? [currentMessage] : []),
    ...messagesAfter,
  ];

  return allMessages.map((message) => ({
    id: message.id,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    messageSender: serializeModerationProfile(message.messageSender ?? null),
    member: message.messageSender || message.member
      ? {
          profile: serializeModerationProfile(
            message.messageSender ?? message.member?.profile ?? null,
          ),
        }
      : null,
    isReported: message.id === targetId,
  }));
}

export async function loadDirectMessageContextForReport(targetId: string) {
  const reportedDM = await db.directMessage.findUnique({
    where: { id: targetId },
    select: { conversationId: true, createdAt: true },
  });

  if (!reportedDM) {
    return [];
  }

  const [dmsBefore, dmsAfter, currentDM] = await Promise.all([
    db.directMessage.findMany({
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
    }),
    db.directMessage.findMany({
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
    }),
    db.directMessage.findUnique({
      where: { id: targetId },
      include: {
        sender: {
          select: moderationProfileSelect,
        },
      },
    }),
  ]);

  const allDMs = [
    ...dmsBefore.reverse(),
    ...(currentDM ? [currentDM] : []),
    ...dmsAfter,
  ];

  return allDMs.map((dm) => ({
    id: dm.id,
    content: dm.content,
    createdAt: dm.createdAt.toISOString(),
    member: {
      profile: serializeModerationProfile(dm.sender),
    },
    isReported: dm.id === targetId,
  }));
}

export async function loadCommunityPostContextForReport(targetId: string) {
  const post = await db.communityPost.findUnique({
    where: { id: targetId },
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

  if (!post) {
    return null;
  }

  return {
    id: post.id,
    content: post.content,
    deleted: post.deleted,
    createdAt: post.createdAt.toISOString(),
    board: post.board,
    author: serializeModerationProfile(post.author),
  };
}

export async function loadCommunityPostCommentContextForReport(targetId: string) {
  const comment = await db.communityPostComment.findUnique({
    where: { id: targetId },
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

  if (!comment) {
    return null;
  }

  return {
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
          author: serializeModerationProfile(comment.replyToComment.author),
        }
      : null,
  };
}

export async function loadScopedReportTargetContext(input: {
  targetType: ReportTargetType;
  targetId: string;
}) {
  switch (input.targetType) {
    case ReportTargetType.MESSAGE:
      return {
        messageContext: await loadMessageContextForReport(input.targetId),
      };
    case ReportTargetType.DIRECT_MESSAGE:
      return {
        messageContext: await loadDirectMessageContextForReport(input.targetId),
      };
    case ReportTargetType.COMMUNITY_POST:
      return {
        communityPost: await loadCommunityPostContextForReport(input.targetId),
      };
    case ReportTargetType.COMMUNITY_POST_COMMENT:
      return {
        communityPostComment: await loadCommunityPostCommentContextForReport(
          input.targetId,
        ),
      };
    default:
      return {};
  }
}
