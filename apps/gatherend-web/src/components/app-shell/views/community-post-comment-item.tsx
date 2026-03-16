"use client";

import { memo } from "react";
import { useTheme } from "next-themes";
import { AnimatedSticker } from "@/components/ui/animated-sticker";
import { UserAvatarMenu } from "@/components/user-avatar-menu";
import {
  getGradientAnimationClass,
  getUsernameColorStyle,
} from "@/lib/username-color";
import { getUsernameFormatClasses } from "@/lib/username-format";
import { cn } from "@/lib/utils";
import type {
  ClientProfileSummary,
  ClientUploadedAsset,
} from "@/types/uploaded-assets";

type CommunityPostCommentAuthor = Omit<ClientProfileSummary, "profileTags"> & {
  profileTags?: string[];
};

export interface CommunityPostCommentItemData {
  id: string;
  postId: string;
  content: string;
  deleted: boolean;
  imageAsset: ClientUploadedAsset | null;
  createdAt: string;
  updatedAt: string;
  author: CommunityPostCommentAuthor;
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
}

interface CommunityPostCommentItemProps {
  comment: CommunityPostCommentItemData;
  currentProfileId: string;
  className?: string;
  onReply?: (commentId: string) => void;
}

function formatCommentDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getReplyPreview(content: string, deleted: boolean) {
  if (deleted) {
    return "comentario eliminado";
  }

  if (content.length <= 72) {
    return content;
  }

  return `${content.slice(0, 72)}...`;
}

function getReplyingToLabel(comment: CommunityPostCommentItemData) {
  if (!comment.replyToCommentId || !comment.replyToComment) {
    return "OP";
  }

  const sourceText = comment.replyToComment.deleted
    ? "comentario eliminado"
    : comment.replyToComment.content.trim();
  const preview = sourceText.slice(0, 20);
  const suffix = sourceText.length <= 20 ? "" : "...";

  return `${comment.replyToComment.author.username}: ${preview}${suffix}`;
}

function CommunityPostCommentItemInner({
  comment,
  currentProfileId,
  className,
  onReply,
}: CommunityPostCommentItemProps) {
  const { resolvedTheme } = useTheme();
  const authorAvatarUrl = comment.author.avatarAsset?.url || "";
  const authorBadgeStickerUrl = comment.author.badgeSticker?.asset?.url || null;
  const commentImageUrl = comment.imageAsset?.url || null;
  const isOwnComment = comment.author.id === currentProfileId;

  return (
    <article
      className={cn(
        "block w-fit max-w-full border border-theme-border bg-theme-bg-secondary/20 px-3 py-2",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <UserAvatarMenu
          profileId={comment.author.id}
          profileImageUrl={authorAvatarUrl}
          username={comment.author.username}
          discriminator={comment.author.discriminator}
          currentProfileId={currentProfileId}
          className="h-8 w-8 shrink-0"
          showStatus={false}
          disableHoverShadow
          avatarAnimationMode="never"
        />

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1">
            {(comment.author.badge || authorBadgeStickerUrl) && (
              <>
                <span className="inline-flex items-center gap-0.5">
                  {authorBadgeStickerUrl && (
                    <AnimatedSticker
                      src={authorBadgeStickerUrl}
                      alt="badge"
                      containerClassName="h-4 w-4"
                      fallbackWidthPx={16}
                      fallbackHeightPx={16}
                      className="object-contain"
                      isHovered={false}
                    />
                  )}
                  {comment.author.badge && (
                    <span className="pt-2 text-[10px] leading-none text-theme-text-tertiary">
                      {comment.author.badge}
                    </span>
                  )}
                </span>
                <span className="pt-2 text-[10px] text-theme-text-tertiary">
                  |
                </span>
              </>
            )}
            <span
              className={cn(
                "text-[12px] font-semibold",
                getUsernameFormatClasses(comment.author.usernameFormat),
                getGradientAnimationClass(comment.author.usernameColor),
              )}
              style={getUsernameColorStyle(comment.author.usernameColor, {
                isOwnProfile: isOwnComment,
                themeMode: (resolvedTheme as "dark" | "light") || "dark",
              })}
            >
              {comment.author.username}
            </span>
            <span className="text-[10px] text-theme-text-tertiary">
              {formatCommentDate(comment.createdAt)}
            </span>
            {comment.replyToCommentId && comment.replyToComment && (
              <>
                <span className="text-[10px] text-theme-text-tertiary">|</span>
                <span className="text-[10px] text-theme-text-tertiary">
                  Replying to {getReplyingToLabel(comment)}
                </span>
              </>
            )}
          </div>

          {commentImageUrl && (
            <div className={cn(comment.content && "mb-2")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={commentImageUrl}
                alt={comment.content || "comment image"}
                className="max-h-[120px] max-w-[120px] border border-theme-border object-contain"
                loading="lazy"
                decoding="async"
              />
            </div>
          )}

          <div
            className={cn(
              "whitespace-pre-wrap break-words text-[12px] leading-5 text-theme-text-secondary [overflow-wrap:anywhere]",
              comment.deleted && "text-[11px] italic text-theme-text-tertiary",
            )}
          >
            {comment.deleted ? "comentario eliminado" : comment.content}
          </div>

          {!comment.deleted && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => onReply?.(comment.id)}
                className="cursor-pointer text-[12px] text-theme-text-tertiary transition hover:underline"
              >
                Reply
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export const CommunityPostCommentItem = memo(CommunityPostCommentItemInner);
