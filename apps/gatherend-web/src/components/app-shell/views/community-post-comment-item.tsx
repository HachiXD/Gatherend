"use client";

import { memo, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { AnimatedSticker } from "@/components/ui/animated-sticker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatarMenu } from "@/components/user-avatar-menu";
import {
  getGradientAnimationClass,
  getUsernameColorStyle,
  getUsernameTintBackgroundStyle,
} from "@/lib/username-color";
import { getOptimizedStaticUiImageUrl } from "@/lib/ui-image-optimizer";
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
  onReport?: (commentId: string) => void;
  onEdit?: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
}

function formatCommentDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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
  onReport,
  onEdit,
  onDelete,
}: CommunityPostCommentItemProps) {
  const { resolvedTheme } = useTheme();
  const authorAvatarUrl = comment.author.avatarAsset?.url || "";
  const authorBadgeStickerUrl = comment.author.badgeSticker?.asset?.url || null;
  const commentImageUrl = comment.imageAsset?.url || null;
  const isOwnComment = comment.author.id === currentProfileId;
  const themeMode = (resolvedTheme as "dark" | "light") || "dark";
  const [forceOriginalCommentImage, setForceOriginalCommentImage] =
    useState(false);
  const commentHeaderTintStyle = getUsernameTintBackgroundStyle(
    comment.author.usernameColor,
    themeMode,
  );
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
    <article
      className={cn(
        "block w-fit max-w-full border border-theme-border bg-theme-bg-secondary/20 px-3 py-2",
        className,
      )}
    >
      <div
        className="-mx-3 -mt-2 mb-2 flex flex-wrap items-center gap-1 border-b border-theme-border px-2 py-0.5"
        style={commentHeaderTintStyle}
      >
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
                <span className="pt-2 text-[11px] leading-none text-theme-text-tertiary">
                  {comment.author.badge}
                </span>
              )}
            </span>
            <span className="pt-2 text-[11px] text-theme-text-tertiary">|</span>
          </>
        )}
        <span className="text-[11px] text-theme-text-tertiary">
          <span className="inline-block pt-2">
            {formatCommentDate(comment.createdAt)}
          </span>
        </span>
        {comment.replyToCommentId && comment.replyToComment && (
          <>
            <span className="inline-block pt-2 text-[11px] text-theme-text-tertiary">
              |
            </span>
            <span className="inline-block pt-2 text-[11px] text-theme-text-tertiary">
              Replying to {getReplyingToLabel(comment)}
            </span>
          </>
        )}
      </div>

      <div className="flex items-start gap-2.5">
        <UserAvatarMenu
          profileId={comment.author.id}
          profileImageUrl={authorAvatarUrl}
          username={comment.author.username}
          discriminator={comment.author.discriminator}
          currentProfileId={currentProfileId}
          className="mt-0 h-8 w-8 shrink-0"
          showStatus={false}
          disableHoverShadow
          avatarAnimationMode="never"
        />

        <div className="min-w-0 flex-1">
          {commentImageUrl && (
            <div className={cn(comment.content && "mb-2")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={renderedCommentImageUrl || undefined}
                alt={comment.content || "comment image"}
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
              "whitespace-pre-wrap break-words text-[14px] leading-5 text-theme-text-secondary [overflow-wrap:anywhere]",
              comment.deleted && "mt-1.5",
              comment.deleted && "text-[14px] text-theme-text-tertiary",
            )}
          >
            <span className="whitespace-nowrap">
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
                    "cursor-pointer text-[14px] font-semibold text-white hover:underline",
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
              <span
                className={cn(
                  "text-[14px] font-semibold",
                  getGradientAnimationClass(comment.author.usernameColor),
                )}
                style={getUsernameColorStyle(comment.author.usernameColor, {
                  isOwnProfile: isOwnComment,
                  themeMode,
                })}
              >
                :
              </span>
            </span>
            {"\u00A0"}
            <span className={cn(comment.deleted && "italic")}>
              {comment.deleted ? "Comentario eliminado" : comment.content}
            </span>
          </div>

          {!comment.deleted && (
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => onReply?.(comment.id)}
                className="cursor-pointer text-[14px] text-theme-text-tertiary transition hover:underline"
              >
                Reply
              </button>
              {(onReport || onEdit || onDelete) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="cursor-pointer text-[14px] leading-none text-theme-text-tertiary transition hover:underline"
                      aria-label="Open comment actions"
                    >
                      ...
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    side="bottom"
                    className="w-36 border border-theme-border-secondary bg-theme-bg-dropdown-menu-primary p-1 text-xs text-theme-text-secondary"
                  >
                    {onReport && (
                      <DropdownMenuItem
                        onClick={() => onReport(comment.id)}
                        className="cursor-pointer"
                      >
                        Report
                      </DropdownMenuItem>
                    )}
                    {onEdit && (
                      <DropdownMenuItem
                        onClick={() => onEdit(comment.id)}
                        className="cursor-pointer"
                      >
                        Edit
                      </DropdownMenuItem>
                    )}
                    {onDelete && (
                      <DropdownMenuItem
                        onClick={() => onDelete(comment.id)}
                        className="cursor-pointer"
                      >
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export const CommunityPostCommentItem = memo(CommunityPostCommentItemInner);
