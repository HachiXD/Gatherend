"use client";

import { memo, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { AnimatedSticker } from "@/components/ui/animated-sticker";
import { UserAvatarMenu } from "@/components/user-avatar-menu";
import {
  getGradientAnimationClass,
  getUsernameColorStyle,
} from "@/lib/username-color";
import { getOptimizedStaticUiImageUrl } from "@/lib/ui-image-optimizer";
import { getUsernameFormatClasses } from "@/lib/username-format";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
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
  onReport?: (commentId: string) => void;
  onEdit?: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
}

function formatCommentDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getReplyingToLabel(
  comment: CommunityPostCommentItemData,
  labels: {
    replyToOriginalPoster: string;
    deletedCommentInline: string;
  },
) {
  if (!comment.replyToCommentId || !comment.replyToComment) {
    return labels.replyToOriginalPoster;
  }

  const sourceText = comment.replyToComment.deleted
    ? labels.deletedCommentInline
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
  onReport,
  onEdit,
  onDelete,
}: CommunityPostCommentItemProps) {
  const { resolvedTheme } = useTheme();
  const { t, locale } = useTranslation();
  const authorAvatarUrl = comment.author.avatarAsset?.url || "";
  const authorBadgeStickerUrl = comment.author.badgeSticker?.asset?.url || null;
  const commentImageUrl = comment.imageAsset?.url || null;
  const isOwnComment = comment.author.id === currentProfileId;
  const themeMode = (resolvedTheme as "dark" | "light") || "dark";
  const [forceOriginalCommentImage, setForceOriginalCommentImage] =
    useState(false);
  const renderedCommentImageUrl = useMemo(() => {
    if (!commentImageUrl || forceOriginalCommentImage) return commentImageUrl;
    return getOptimizedStaticUiImageUrl(commentImageUrl, {
      w: 240,
      h: 240,
      q: 84,
      resize: "fit",
      gravity: "sm",
    });
  }, [commentImageUrl, forceOriginalCommentImage]);

  return (
    <article className={cn("flex items-start gap-2", className)}>
      <UserAvatarMenu
        profileId={comment.author.id}
        profileImageUrl={authorAvatarUrl}
        username={comment.author.username}
        discriminator={comment.author.discriminator}
        currentProfileId={currentProfileId}
        className="mt-0.5 h-7 w-7 shrink-0"
        showStatus={false}
        disableHoverShadow
        avatarAnimationMode="never"
      />

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex flex-wrap items-baseline gap-x-1.5">
          <UserAvatarMenu
            profileId={comment.author.id}
            profileImageUrl={authorAvatarUrl}
            username={comment.author.username}
            discriminator={comment.author.discriminator}
            currentProfileId={currentProfileId}
            showStatus={false}
            usernameColor={comment.author.usernameColor}
            usernameFormat={comment.author.usernameFormat}
            hideAvatar
          >
            <span
              className={cn(
                "cursor-pointer text-[13px] font-semibold text-white hover:underline",
                getUsernameFormatClasses(comment.author.usernameFormat),
                getGradientAnimationClass(comment.author.usernameColor),
              )}
              style={getUsernameColorStyle(comment.author.usernameColor, {
                isOwnProfile: isOwnComment,
                themeMode,
              })}
            >
              {comment.author.username}
            </span>
          </UserAvatarMenu>

          {(comment.author.badge || authorBadgeStickerUrl) && (
            <span className="inline-flex items-center gap-0.5">
              {authorBadgeStickerUrl && (
                <AnimatedSticker
                  src={authorBadgeStickerUrl}
                  alt="badge"
                  containerClassName="h-3.5 w-3.5"
                  fallbackWidthPx={14}
                  fallbackHeightPx={14}
                  className="object-contain"
                  isHovered={false}
                />
              )}
              {comment.author.badge && (
                <span className="text-[11px] text-theme-text-tertiary">
                  {comment.author.badge}
                </span>
              )}
            </span>
          )}

          <span className="text-[11px] text-theme-text-tertiary">
            {formatCommentDate(comment.createdAt, locale)}
          </span>

          {comment.replyToCommentId && comment.replyToComment && (
            <span className="text-[11px] text-theme-text-tertiary">
              ·{" "}{t.chat.replyingTo}{" "}
              {getReplyingToLabel(comment, {
                replyToOriginalPoster: t.posts.replyToOriginalPoster,
                deletedCommentInline: t.posts.deletedCommentInline,
              })}
            </span>
          )}
        </div>

        {commentImageUrl && (
          <div className={cn(comment.content && "mb-2")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={renderedCommentImageUrl || undefined}
              alt={comment.content || t.posts.commentImageAlt}
              className="max-h-[120px] max-w-[120px] border border-theme-border object-contain"
              loading="lazy"
              decoding="async"
              onError={() => {
                if (
                  commentImageUrl &&
                  renderedCommentImageUrl !== commentImageUrl
                ) {
                  setForceOriginalCommentImage(true);
                }
              }}
            />
          </div>
        )}

        <div
          className={cn(
            "break-words text-[14px] leading-5 text-theme-text-secondary [overflow-wrap:anywhere]",
            comment.deleted && "italic text-theme-text-tertiary",
          )}
        >
          {comment.deleted ? t.posts.deletedComment : comment.content}
        </div>

        {!comment.deleted && (
          <div className="mt-1 flex items-center gap-3">
            <button
              type="button"
              onClick={() => onReply?.(comment.id)}
              className="cursor-pointer text-[13px] text-theme-text-tertiary transition hover:underline"
            >
              {t.chat.reply}
            </button>
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(comment.id)}
                className="cursor-pointer text-[13px] text-theme-text-tertiary transition hover:underline"
              >
                {t.common.edit}
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(comment.id)}
                className="cursor-pointer text-[13px] text-theme-text-tertiary transition hover:underline"
              >
                {t.common.delete}
              </button>
            )}
            {onReport && (
              <button
                type="button"
                onClick={() => onReport(comment.id)}
                className="cursor-pointer text-[13px] text-theme-text-tertiary transition hover:underline"
              >
                {t.posts.reportComment}
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export const CommunityPostCommentItem = memo(CommunityPostCommentItemInner);
