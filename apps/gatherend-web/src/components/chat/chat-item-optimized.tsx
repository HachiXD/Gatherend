"use client";

import {
  memo,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  lazy,
  Suspense,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { MemberRole } from "@prisma/client";
import type { BoardCurrentMember } from "@/lib/boards/board-types";
import { UserAvatarMenu } from "../user-avatar-menu";
import { AvatarGroupHoverContext, UserAvatar } from "../user-avatar";
import { FileIcon } from "lucide-react";
import { AnimatedSticker } from "@/components/ui/animated-sticker";
import { cn } from "@/lib/utils";
import { MessageReactionsDisplay } from "./message-reactions";
import { parseMentions } from "@/lib/parse-mentions";
import { ParsedMessageContent } from "@/lib/parse-invite-links";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/i18n";
import { useEffectiveThemeMode } from "@/hooks/use-effective-theme-config";
import {
  getUsernameColorStyle,
  getGradientAnimationClass,
} from "@/lib/username-color";
import { getUsernameFormatClasses } from "@/lib/username-format";
import type { ClientProfile } from "@/hooks/use-current-profile";
import { useMessageRetryStore } from "@/hooks/use-message-retry";
import {
  useOptimisticMessages,
  type ServerMessage,
} from "@/hooks/use-optimistic-messages";
import qs from "query-string";
import { getExpressAuthHeaders } from "@/lib/express-fetch";
import type {
  ClientAttachmentAsset,
  ClientProfileSummary,
  ClientSticker,
} from "@/types/uploaded-assets";
import { isMissingMessageAuthor } from "@/hooks/chat/message-author";
import { GROUPED_TEXT_BUBBLE_EXTERNAL_HOVER_CLASS } from "./chat-grouped-layout";
import { getChatBubbleSurfaceStyle } from "./chat-bubble-style-render";

// Lazy load heavy components - only loaded when needed
const ChatItemActions = lazy(() =>
  import("./chat-item-actions").then((m) => ({ default: m.ChatItemActions })),
);
const ChatItemEditForm = lazy(() =>
  import("./chat-item-edit-form").then((m) => ({
    default: m.ChatItemEditForm,
  })),
);

interface ChatItemOptimizedProps {
  id: string;
  content: string;
  isChannel: boolean;
  messageSenderId?: string | null;
  member?: {
    id: string;
    role: MemberRole;
    profile: ClientProfileSummary;
  } | null;
  author: ClientProfileSummary;
  timestamp: string;
  attachmentAsset: ClientAttachmentAsset | null;
  filePreviewUrl?: string | null;
  fileStaticPreviewUrl?: string | null;
  sticker?: ClientSticker | null;
  reactions?: Array<{
    id: string;
    emoji: string;
    profileId: string;
    profile: ClientProfileSummary;
  }>;
  deleted: boolean;
  currentProfile: ClientProfile;
  currentMember?: BoardCurrentMember | null;
  isUpdated: boolean;
  isOptimistic?: boolean;
  isFailed?: boolean;
  tempId?: string;
  apiUrl: string;
  socketQuery: Record<string, string>;
  replyTo?: {
    id: string;
    content: string;
    sender: ClientProfileSummary | null;
    attachmentAsset?: ClientAttachmentAsset | null;
    fileUrl?: string | null;
    fileName?: string | null;
    sticker?: ClientSticker | null;
  } | null;
  pinned?: boolean;
  isCompact?: boolean;
  isLastMessage?: boolean;
  textBubbleGroupPosition?: "single" | "start" | "middle" | "end";
  groupedTextBubble?: boolean;
  hideAvatarColumn?: boolean;
  showGroupedHeader?: boolean;
  externalHoverArea?: boolean;
  messageCompactData?: "0" | "1";
  compactRevisionData?: number;
  forcedHovered?: boolean;
  onHoverChange?: (hovered: boolean) => void;
}

const FALLBACK_CHAT_IMAGE_PREVIEW_SIZE = { width: 224, height: 168 };
const CHAT_IMAGE_LANDSCAPE_MIN_RATIO = 1.6;
const CHAT_IMAGE_PORTRAIT_MAX_RATIO = 0.625;
const CHAT_IMAGE_BUCKET_LANDSCAPE = { width: 540, height: 330 };
const CHAT_IMAGE_BUCKET_PORTRAIT = { width: 300, height: 370 };
const CHAT_IMAGE_BUCKET_SQUAREISH = { width: 320, height: 320 };

function getUrlPathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    // If it's not a full URL, treat as path-like string.
    return url.split("?")[0]?.split("#")[0] || url;
  }
}

function looksLikeAnimatableImage(url: string | null): boolean {
  if (!url) return false;
  const path = getUrlPathname(url).toLowerCase();
  return (
    path.endsWith(".webp") || path.endsWith(".gif") || path.endsWith(".apng")
  );
}

function isExpressMediaAttachmentUrl(
  url: string,
  apiUrl: string | null,
): boolean {
  if (!url) return false;
  if (!apiUrl) return false;
  return url.startsWith(`${apiUrl}/media/attachment?`);
}

function getChatAttachmentPreviewBucket(ratio: number): {
  width: number;
  height: number;
} {
  if (ratio >= CHAT_IMAGE_LANDSCAPE_MIN_RATIO) {
    return CHAT_IMAGE_BUCKET_LANDSCAPE;
  }

  if (ratio <= CHAT_IMAGE_PORTRAIT_MAX_RATIO) {
    return CHAT_IMAGE_BUCKET_PORTRAIT;
  }

  return CHAT_IMAGE_BUCKET_SQUAREISH;
}

function getChatAttachmentPreviewSize({
  originalWidth,
  originalHeight,
  allowUpscale,
}: {
  originalWidth: number;
  originalHeight: number;
  allowUpscale?: boolean;
}) {
  if (!originalWidth || !originalHeight) {
    return FALLBACK_CHAT_IMAGE_PREVIEW_SIZE;
  }

  const ratio = originalWidth / originalHeight;
  const bucket = getChatAttachmentPreviewBucket(ratio);
  const scaleDownOrUp = Math.min(
    bucket.width / originalWidth,
    bucket.height / originalHeight,
  );
  const scale = allowUpscale ? scaleDownOrUp : Math.min(scaleDownOrUp, 1);

  return {
    width: Math.max(1, Math.round(originalWidth * scale)),
    height: Math.max(1, Math.round(originalHeight * scale)),
  };
}

// Reply preview - extracted for clarity
const ReplyPreview = memo(function ReplyPreview({
  replyTo,
  t,
  groupedTextBubble,
  isCompact,
  insideBubble = false,
  groupedStartInsideBubble = false,
}: {
  replyTo: NonNullable<ChatItemOptimizedProps["replyTo"]>;
  t: ReturnType<typeof useTranslation>["t"];
  groupedTextBubble?: boolean;
  isCompact?: boolean;
  insideBubble?: boolean;
  groupedStartInsideBubble?: boolean;
}) {
  const replyAuthor = replyTo.sender;

  const getReplyPreview = () => {
    if (replyTo.sticker) return `🎨 ${t.chat.sticker}`;
    if (replyTo.fileUrl) return `📎 ${replyTo.fileName || t.chat.file}`;
    return replyTo.content.length > 50
      ? replyTo.content.substring(0, 50) + "..."
      : replyTo.content;
  };

  return (
    <div
      data-chat-item-block="reply-preview"
      className={cn(
        "border-l-2 border-theme-border-accent-item-reply-preview pl-2.5",
        insideBubble
          ? cn("mb-0.5", groupedStartInsideBubble && "mt-0.5")
          : cn(
              "mt-2",
              groupedTextBubble && "ml-3",
              isCompact ? "mb-0" : "-mb-2",
            ),
      )}
    >
      <div className="text-xs text-theme-text-tertiary break-words">
        <span className="font-semibold">
          {replyAuthor?.username || t.chat.deletedMember}
        </span>
        <span>: </span>
        <span>{getReplyPreview()}</span>
      </div>
    </div>
  );
});

// Message content - extracted
const MessageContent = memo(function MessageContent({
  content,
  deleted,
  isUpdated,
  isOptimistic,
  isFailed,
  t,
  inlineUsername,
  failedAction,
}: {
  content: string;
  deleted: boolean;
  isUpdated: boolean;
  isOptimistic: boolean;
  isFailed: boolean;
  t: ReturnType<typeof useTranslation>["t"];
  inlineUsername?: React.ReactNode;
  failedAction?: React.ReactNode;
}) {
  return (
    <div
      data-chat-item-block="message-content"
      className={cn(
        "text-[15px] text-theme-text-secondary whitespace-pre-wrap [overflow-wrap:anywhere]",
        deleted && "italic text-theme-text-tertiary text-xs mt-1",
        isOptimistic && !isFailed && "text-theme-text-muted italic",
        isFailed && "text-red-400",
      )}
    >
      {inlineUsername}
      <ParsedMessageContent content={content} renderMentions={parseMentions} />
      {isUpdated && !deleted && (
        <span className="text-[10px] mx-2 text-theme-text-tertiary">
          ({t.chat.messageEdited})
        </span>
      )}
      {failedAction}
    </div>
  );
});

const ProfileNameTrigger = memo(function ProfileNameTrigger({
  canOpenAuthorProfile,
  authorProfile,
  currentProfile,
  memberId,
  isOptimistic,
  isFailed,
  isOwnMessage,
  resolvedTheme,
}: {
  canOpenAuthorProfile: boolean;
  authorProfile: Pick<
    ClientProfileSummary,
    "id" | "username" | "discriminator" | "usernameColor" | "usernameFormat"
  > & {
    imageUrl?: string;
  };
  currentProfile: ClientProfile;
  memberId?: string;
  isOptimistic: boolean;
  isFailed: boolean;
  isOwnMessage: boolean;
  resolvedTheme: string | undefined;
}) {
  const usernameClasses = cn(
    canOpenAuthorProfile
      ? "text-[15px] font-semibold text-white cursor-pointer hover:underline"
      : "text-[15px] font-semibold text-theme-text-tertiary",
    getUsernameFormatClasses(authorProfile?.usernameFormat),
    isOptimistic && !isFailed && "text-theme-text-muted",
    isFailed && "text-red-400",
    canOpenAuthorProfile &&
      getGradientAnimationClass(authorProfile?.usernameColor),
  );

  const usernameStyles = getUsernameColorStyle(authorProfile?.usernameColor, {
    isOwnProfile: isOwnMessage,
    themeMode: (resolvedTheme as "dark" | "light") || "dark",
  });

  const usernameNode = (
    <span className={usernameClasses} style={usernameStyles}>
      {authorProfile?.username}
    </span>
  );

  return (
    <>
      {canOpenAuthorProfile ? (
        <UserAvatarMenu
          profileId={authorProfile?.id || ""}
          profileImageUrl={authorProfile?.imageUrl || ""}
          username={authorProfile?.username || ""}
          discriminator={authorProfile?.discriminator}
          currentProfileId={currentProfile.id}
          currentProfile={currentProfile}
          memberId={memberId}
          showStatus={false}
          usernameColor={authorProfile?.usernameColor}
          usernameFormat={authorProfile?.usernameFormat}
          hideAvatar
        >
          {usernameNode}
        </UserAvatarMenu>
      ) : (
        usernameNode
      )}
      <span
        className={cn(
          "text-[15px] font-semibold",
          getGradientAnimationClass(authorProfile?.usernameColor),
        )}
        style={usernameStyles}
      >
        :
      </span>
    </>
  );
});

const ImageViewerDialog = memo(function ImageViewerDialog({
  open,
  onOpenChange,
  fileUrl,
  fileName,
  content,
  imageViewerContainerRef,
  imageViewerImgRef,
  imageViewerScale,
  imageViewerTranslate,
  isImageViewerPanning,
  handleImageViewerPointerDown,
  handleImageViewerPointerMove,
  handleImageViewerPointerUp,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileUrl: string;
  fileName: string | null;
  content: string;
  imageViewerContainerRef: RefObject<HTMLDivElement | null>;
  imageViewerImgRef: RefObject<HTMLImageElement | null>;
  imageViewerScale: number;
  imageViewerTranslate: { x: number; y: number };
  isImageViewerPanning: boolean;
  handleImageViewerPointerDown: (e: ReactPointerEvent) => void;
  handleImageViewerPointerMove: (e: ReactPointerEvent) => void;
  handleImageViewerPointerUp: (e: ReactPointerEvent) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-none sm:max-w-none gap-0 border-0 bg-transparent p-0 shadow-none rounded-none"
        overlayClassName="bg-black/70"
      >
        <DialogTitle className="sr-only">Image preview</DialogTitle>
        <div
          ref={imageViewerContainerRef}
          className="fixed inset-0 flex items-center justify-center select-none"
          style={{
            cursor:
              imageViewerScale > 1
                ? isImageViewerPanning
                  ? "grabbing"
                  : "zoom-out"
                : "zoom-in",
            touchAction: "none",
          }}
          onPointerDown={handleImageViewerPointerDown}
          onPointerMove={handleImageViewerPointerMove}
          onPointerUp={handleImageViewerPointerUp}
          onPointerCancel={handleImageViewerPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageViewerImgRef}
            src={fileUrl}
            alt={fileName || content || "attachment"}
            className="block max-w-[92vw] max-h-[92vh] h-auto w-auto"
            style={{
              transformOrigin: "center center",
              transform: `translate(${imageViewerTranslate.x}px, ${imageViewerTranslate.y}px) scale(${imageViewerScale})`,
              transition: isImageViewerPanning
                ? "none"
                : "transform 160ms ease-out",
              willChange: "transform",
            }}
            loading="eager"
            decoding="async"
            draggable={false}
            onDragStart={(ev) => ev.preventDefault()}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
});

const ChatItemOptimizedComponent = ({
  id,
  content,
  isChannel,
  messageSenderId,
  member,
  author,
  timestamp,
  attachmentAsset,
  filePreviewUrl = null,
  fileStaticPreviewUrl = null,
  sticker,
  reactions = [],
  deleted,
  currentProfile,
  currentMember,
  isUpdated,
  isOptimistic = false,
  isFailed = false,
  tempId,
  apiUrl,
  socketQuery,
  replyTo,
  pinned = false,
  isCompact = false,
  isLastMessage = false,
  textBubbleGroupPosition,
  groupedTextBubble = false,
  hideAvatarColumn = false,
  showGroupedHeader = false,
  externalHoverArea = false,
  messageCompactData,
  compactRevisionData,
  forcedHovered = false,
  onHoverChange,
}: ChatItemOptimizedProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const imageViewerContainerRef = useRef<HTMLDivElement | null>(null);
  const imageViewerImgRef = useRef<HTMLImageElement | null>(null);
  const [imageViewerScale, setImageViewerScale] = useState(1);
  const [imageViewerTranslate, setImageViewerTranslate] = useState({
    x: 0,
    y: 0,
  });
  const [isImageViewerPanning, setIsImageViewerPanning] = useState(false);
  const imageViewerPanStartRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startTranslateX: number;
    startTranslateY: number;
    moved: boolean;
  } | null>(null);
  const imageViewerBackdropStartRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const [forceOriginalImage, setForceOriginalImage] = useState<{
    url: string;
    value: boolean;
  } | null>(null);
  const [
    disableExpressAttachmentPreviews,
    setDisableExpressAttachmentPreviews,
  ] = useState<{
    url: string;
    value: boolean;
  } | null>(null);

  // Animated attachments (WebP/GIF/APNG):
  // - default: show a static first-frame preview
  // - when the attachment is inside the center band of the viewport: swap to animated preview
  const attachmentButtonRef = useRef<HTMLButtonElement | null>(null);
  // Observe a 1x1 center-point sentinel so we get reliable enter/leave events for the center band.
  // Observing the whole element can miss updates when intersection ratio stays constant.
  const attachmentCenterSentinelRef = useRef<HTMLSpanElement | null>(null);
  const [isAttachmentInCenterBand, setIsAttachmentInCenterBand] =
    useState(false);
  const attachmentSwapTokenRef = useRef(0);
  const [attachmentDisplayedUrlState, setAttachmentDisplayedUrlState] =
    useState<{
      fileUrl: string;
      url: string;
    } | null>(null);

  const { t } = useTranslation();
  const resolvedTheme = useEffectiveThemeMode();
  const getRetryData = useMessageRetryStore((state) => state.getRetryData);
  const removeRetryData = useMessageRetryStore(
    (state) => state.removeRetryData,
  );
  const setRetryData = useMessageRetryStore((state) => state.setRetryData);
  const {
    addOptimisticMessage,
    removeOptimisticMessage,
    confirmOptimisticMessage,
  } = useOptimisticMessages();

  const channelId = socketQuery.channelId as string | undefined;
  const conversationId = socketQuery.conversationId as string | undefined;
  const authorProfileBase = author;
  const canOpenAuthorProfile = !isMissingMessageAuthor(authorProfileBase);
  const authorProfile = useMemo(
    () => ({
      ...authorProfileBase,
      imageUrl: authorProfileBase.avatarAsset?.url || "",
      badgeStickerUrl: authorProfileBase.badgeSticker?.asset?.url || null,
    }),
    [authorProfileBase],
  );
  const fileUrl = attachmentAsset?.url || null;
  const fileName = attachmentAsset?.originalName || null;
  const fileType = attachmentAsset?.mimeType || null;
  const fileSize = attachmentAsset?.sizeBytes ?? null;
  const fileWidth = attachmentAsset?.width ?? null;
  const fileHeight = attachmentAsset?.height ?? null;

  const isOwnMessage = isChannel
    ? messageSenderId === currentProfile.id
    : authorProfile.id === currentProfile.id;

  const isImage = fileType?.startsWith("image/");
  const isPDF = fileType === "application/pdf";

  const fallbackQueryKey = useMemo(() => {
    if (channelId) return ["chat", "channel", channelId];
    if (conversationId) return ["chat", "conversation", conversationId];
    return [];
  }, [channelId, conversationId]);

  const canRetry = Boolean(isFailed && tempId);

  const handleRetry = useCallback(async () => {
    if (!tempId) return;

    const retryData = getRetryData(tempId);
    const effectiveQueryKey = retryData?.queryKey ?? fallbackQueryKey;
    if (effectiveQueryKey.length === 0) return;

    const effectiveData = retryData ?? {
      content,
      attachmentAsset: attachmentAsset || null,
      sticker: sticker || undefined,
      apiUrl,
      query: socketQuery,
      profileId: currentProfile.id,
      queryKey: effectiveQueryKey,
      replyToId: replyTo?.id,
    };

    setIsRetrying(true);

    removeOptimisticMessage(effectiveQueryKey, tempId);
    if (retryData) {
      removeRetryData(tempId);
    }

    const newTempId = addOptimisticMessage(
      effectiveQueryKey,
      effectiveData.content,
      currentProfile,
      effectiveData.sticker,
    );

    setRetryData(newTempId, {
      tempId: newTempId,
      content: effectiveData.content,
      attachmentAsset: effectiveData.attachmentAsset,
      sticker: effectiveData.sticker,
      apiUrl: effectiveData.apiUrl,
      query: effectiveData.query,
      profileId: effectiveData.profileId,
      queryKey: effectiveQueryKey,
      replyToId: effectiveData.replyToId,
    });

    try {
      const url = qs.stringifyUrl({
        url: effectiveData.apiUrl,
        query: effectiveData.query,
      });

      const payload: Record<string, unknown> = { tempId: newTempId };
      if (effectiveData.sticker) {
        payload.stickerId = effectiveData.sticker.id;
      } else if (effectiveData.attachmentAsset) {
        payload.attachmentAssetId = effectiveData.attachmentAsset.id;
        payload.content =
          effectiveData.attachmentAsset.originalName || effectiveData.content;
      } else {
        payload.content = effectiveData.content;
        if (effectiveData.replyToId) {
          payload.replyToId = effectiveData.replyToId;
        }
      }

      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          ...getExpressAuthHeaders(effectiveData.profileId),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Retry failed: ${res.status}`);
      }

      const data = (await res.json().catch(() => null)) as ServerMessage | null;
      if (data) {
        confirmOptimisticMessage(effectiveQueryKey, newTempId, data);
      }

      removeRetryData(newTempId);
    } catch (error) {
      // Keep retry data for the new optimistic message.
      // It will be marked as failed again after timeout if it doesn't go through.
      console.error("Retry failed:", error);
    } finally {
      setIsRetrying(false);
    }
  }, [
    tempId,
    getRetryData,
    fallbackQueryKey,
    content,
    attachmentAsset,
    sticker,
    apiUrl,
    socketQuery,
    currentProfile,
    replyTo?.id,
    removeOptimisticMessage,
    removeRetryData,
    addOptimisticMessage,
    setRetryData,
    confirmOptimisticMessage,
  ]);

  // Compute permissions without hooks
  let canDeleteMessage = false;
  if (isChannel) {
    const isOwner = currentMember?.role === MemberRole.OWNER;
    const isAdmin = currentMember?.role === MemberRole.ADMIN;
    const isModerator = currentMember?.role === MemberRole.MODERATOR;
    canDeleteMessage =
      !deleted && (isOwner || isAdmin || isModerator || isOwnMessage);
  } else {
    canDeleteMessage = !deleted && isOwnMessage;
  }

  const showActions = !isOptimistic && (canDeleteMessage || !deleted);

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    onHoverChange?.(true);
  }, [onHoverChange]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    onHoverChange?.(false);
  }, [onHoverChange]);

  const resetImageViewerZoom = useCallback(() => {
    setImageViewerScale(1);
    setImageViewerTranslate({ x: 0, y: 0 });
    setIsImageViewerPanning(false);
    imageViewerPanStartRef.current = null;
    imageViewerBackdropStartRef.current = null;
  }, []);

  useEffect(() => {
    if (!isImageViewerOpen) {
      resetImageViewerZoom();
    }
  }, [isImageViewerOpen, resetImageViewerZoom]);

  const clampImageViewerTranslate = useCallback(
    (next: { x: number; y: number }, nextScale: number) => {
      const container = imageViewerContainerRef.current;
      const img = imageViewerImgRef.current;
      if (!container || !img) return next;

      const stageW = Math.max(1, Math.round(container.clientWidth));
      const stageH = Math.max(1, Math.round(container.clientHeight));
      // Layout size (not affected by CSS transforms).
      const baseW = Math.max(1, Math.round(img.offsetWidth));
      const baseH = Math.max(1, Math.round(img.offsetHeight));
      const scaledW = baseW * nextScale;
      const scaledH = baseH * nextScale;

      // With a centered stage, translate is a pan offset from center.
      const maxPanX = Math.max(0, (scaledW - stageW) / 2);
      const maxPanY = Math.max(0, (scaledH - stageH) / 2);

      return {
        x: Math.min(maxPanX, Math.max(-maxPanX, next.x)),
        y: Math.min(maxPanY, Math.max(-maxPanY, next.y)),
      };
    },
    [],
  );

  const toggleImageViewerZoomAt = useCallback(
    (clientX: number, clientY: number) => {
      const img = imageViewerImgRef.current;
      if (!img) return;

      const ZOOM_SCALE = 2;

      if (imageViewerScale > 1) {
        resetImageViewerZoom();
        return;
      }

      const rect = img.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;
      const targetScale = ZOOM_SCALE;

      // Pan so the clicked point becomes the stage center after scaling.
      const dxFromCenter = clickX - rect.width / 2;
      const dyFromCenter = clickY - rect.height / 2;
      const targetTranslate = clampImageViewerTranslate(
        { x: -dxFromCenter * targetScale, y: -dyFromCenter * targetScale },
        targetScale,
      );

      setImageViewerScale(targetScale);
      setImageViewerTranslate(targetTranslate);
    },
    [clampImageViewerTranslate, imageViewerScale, resetImageViewerZoom],
  );

  const handleImageViewerPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const container = imageViewerContainerRef.current;
      if (!container) return;

      // Backdrop click tracking (so drag/pan doesn't accidentally close the dialog)
      if (e.target === e.currentTarget) {
        container.setPointerCapture(e.pointerId);
        imageViewerBackdropStartRef.current = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          moved: false,
        };
        return;
      }

      if (imageViewerImgRef.current && e.target !== imageViewerImgRef.current) {
        return;
      }

      container.setPointerCapture(e.pointerId);
      setIsImageViewerPanning(false);
      imageViewerPanStartRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startTranslateX: imageViewerTranslate.x,
        startTranslateY: imageViewerTranslate.y,
        moved: false,
      };
    },
    [imageViewerTranslate.x, imageViewerTranslate.y],
  );

  const handleImageViewerPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const backdrop = imageViewerBackdropStartRef.current;
      if (backdrop && backdrop.pointerId === e.pointerId) {
        const dx = e.clientX - backdrop.startX;
        const dy = e.clientY - backdrop.startY;
        if (Math.abs(dx) + Math.abs(dy) > 3) backdrop.moved = true;
        return;
      }

      const start = imageViewerPanStartRef.current;
      if (!start) return;
      if (start.pointerId !== e.pointerId) return;

      if (imageViewerScale <= 1) return; // only pan when zoomed

      const dx = e.clientX - start.startX;
      const dy = e.clientY - start.startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) {
        start.moved = true;
        setIsImageViewerPanning(true);
      }

      const next = clampImageViewerTranslate(
        { x: start.startTranslateX + dx, y: start.startTranslateY + dy },
        imageViewerScale,
      );
      setImageViewerTranslate(next);
    },
    [clampImageViewerTranslate, imageViewerScale],
  );

  const handleImageViewerPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const backdrop = imageViewerBackdropStartRef.current;
      if (backdrop && backdrop.pointerId === e.pointerId) {
        // Only close on a true click (no movement) on the dark backdrop.
        if (!backdrop.moved) {
          setIsImageViewerOpen(false);
        }
        imageViewerBackdropStartRef.current = null;
        return;
      }

      const start = imageViewerPanStartRef.current;
      if (!start) return;
      if (start.pointerId !== e.pointerId) return;

      // If it was a click (no drag), toggle zoom (in at clicked point, or out).
      if (!start.moved) {
        toggleImageViewerZoomAt(e.clientX, e.clientY);
      }

      setIsImageViewerPanning(false);
      imageViewerPanStartRef.current = null;
    },
    [toggleImageViewerZoomAt],
  );

  const serverProvidedImageSize = useMemo(() => {
    if (!fileUrl) return null;
    if (
      typeof fileWidth !== "number" ||
      fileWidth <= 0 ||
      typeof fileHeight !== "number" ||
      fileHeight <= 0
    ) {
      return null;
    }

    // For animatable attachments we may load a small static preview (imgproxy) first and then
    // swap to the original animated asset. Allowing upscale keeps the rendered box stable.
    const allowUpscale =
      fileType === "image/webp" ||
      fileType === "image/gif" ||
      fileType === "image/apng" ||
      looksLikeAnimatableImage(fileUrl);

    return getChatAttachmentPreviewSize({
      originalWidth: fileWidth,
      originalHeight: fileHeight,
      allowUpscale,
    });
  }, [fileHeight, fileType, fileUrl, fileWidth]);

  const fallbackImageSize = useMemo(
    () =>
      getChatAttachmentPreviewSize({
        originalWidth: FALLBACK_CHAT_IMAGE_PREVIEW_SIZE.width,
        originalHeight: FALLBACK_CHAT_IMAGE_PREVIEW_SIZE.height,
      }),
    [],
  );

  const resolvedImageSize = serverProvidedImageSize || fallbackImageSize;
  const imageFrameStyle = useMemo(
    () => ({
      width: "100%",
      maxWidth: `${resolvedImageSize.width}px`,
      aspectRatio: `${resolvedImageSize.width} / ${resolvedImageSize.height}`,
    }),
    [resolvedImageSize.height, resolvedImageSize.width],
  );

  const isAnimatableAttachment =
    fileType === "image/webp" ||
    fileType === "image/gif" ||
    fileType === "image/apng" ||
    looksLikeAnimatableImage(fileUrl);

  useEffect(() => {
    // Reset attachment state when attachment changes.
    attachmentSwapTokenRef.current += 1;
    setAttachmentDisplayedUrlState(null);
    setDisableExpressAttachmentPreviews(null);

    return () => {
      attachmentSwapTokenRef.current += 1;
    };
  }, [fileUrl]);

  const shouldForceOriginal =
    Boolean(fileUrl) && forceOriginalImage?.url === fileUrl
      ? forceOriginalImage.value
      : false;

  const shouldDisableExpressAttachmentPreviews =
    Boolean(fileUrl) && disableExpressAttachmentPreviews?.url === fileUrl
      ? disableExpressAttachmentPreviews.value
      : false;

  const optimizedStillSrc = filePreviewUrl || fileUrl;

  const attachmentStaticPreviewUrl = useMemo(() => {
    if (!fileUrl || !isAnimatableAttachment) return null;
    if (shouldDisableExpressAttachmentPreviews) return null;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return null;

    const dpr =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const width = Math.min(
      1024,
      Math.max(1, Math.round(resolvedImageSize.width * dpr)),
    );
    const height = Math.min(
      1024,
      Math.max(1, Math.round(resolvedImageSize.height * dpr)),
    );

    return `${apiUrl}/media/attachment?src=${encodeURIComponent(
      fileUrl,
    )}&w=${width}&h=${height}&q=82&fmt=webp`;
  }, [
    fileUrl,
    isAnimatableAttachment,
    shouldDisableExpressAttachmentPreviews,
    resolvedImageSize.height,
    resolvedImageSize.width,
  ]);

  const staticFrameSrc =
    attachmentStaticPreviewUrl ||
    fileStaticPreviewUrl ||
    filePreviewUrl ||
    fileUrl;

  const resolvedStaticAttachmentSrc: string = shouldForceOriginal
    ? fileUrl || ""
    : staticFrameSrc || fileUrl || "";

  // For attachments, "animated" should be the original asset (not imgproxy),
  // since imgproxy may be configured to limit animation frames.
  const animatedFrameSrc = fileUrl;

  const resolvedAnimatedAttachmentSrc: string = shouldForceOriginal
    ? fileUrl || ""
    : animatedFrameSrc || fileUrl || "";

  const attachmentDisplayedUrl =
    attachmentDisplayedUrlState?.fileUrl === fileUrl
      ? attachmentDisplayedUrlState.url
      : null;

  const apiUrlForDetect = process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : null;

  // If Express previews have been disabled due to an error, ignore any previously-stored displayed URL
  // that still points at /media/attachment (otherwise we stay stuck on a broken URL).
  const shouldIgnoreDisplayedUrl =
    shouldDisableExpressAttachmentPreviews &&
    typeof attachmentDisplayedUrl === "string" &&
    isExpressMediaAttachmentUrl(attachmentDisplayedUrl, apiUrlForDetect);

  const effectiveAttachmentUrl =
    !shouldIgnoreDisplayedUrl && attachmentDisplayedUrl
      ? attachmentDisplayedUrl
      : resolvedStaticAttachmentSrc;

  useEffect(() => {
    if (!isImage || !fileUrl) return;
    if (!isAnimatableAttachment) return;

    if (!isAttachmentInCenterBand) {
      attachmentSwapTokenRef.current += 1;
      setAttachmentDisplayedUrlState({
        fileUrl,
        url: resolvedStaticAttachmentSrc,
      });
      return;
    }

    // In center band: keep static until animated is fully loaded, then swap.
    const token = (attachmentSwapTokenRef.current += 1);

    const nextUrl = resolvedAnimatedAttachmentSrc;
    const preloader = new window.Image();
    preloader.decoding = "async";
    preloader.onload = () => {
      if (!isAttachmentInCenterBand) return;
      if (attachmentSwapTokenRef.current !== token) return;
      setAttachmentDisplayedUrlState({ fileUrl, url: nextUrl });
    };
    preloader.onerror = () => {
      // Keep static if we can't load the animated URL.
    };
    preloader.src = nextUrl;
  }, [
    fileUrl,
    isAnimatableAttachment,
    isAttachmentInCenterBand,
    isImage,
    resolvedStaticAttachmentSrc,
    resolvedAnimatedAttachmentSrc,
    fileType,
    id,
  ]);

  useEffect(() => {
    // Keep static in sync if it changes (e.g. new preview URL) while out of center band.
    if (!isImage || !fileUrl) return;
    if (!isAnimatableAttachment) return;
    if (isAttachmentInCenterBand) return;
    setAttachmentDisplayedUrlState({
      fileUrl,
      url: resolvedStaticAttachmentSrc,
    });
  }, [
    fileUrl,
    isAnimatableAttachment,
    isAttachmentInCenterBand,
    isImage,
    resolvedStaticAttachmentSrc,
  ]);

  useEffect(() => {
    if (!isImage || !fileUrl) return;
    if (!isAnimatableAttachment) return;
    const node =
      attachmentCenterSentinelRef.current || attachmentButtonRef.current;
    if (!node) return;

    // Only animate when the attachment's center point is within a central vertical band.
    // Using a 1x1 sentinel at the center gives reliable toggles without depending on ratio changes.
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const inBand = entry.isIntersecting;
        setIsAttachmentInCenterBand(inBand);
      },
      {
        root: null,
        rootMargin: "-45% 0px -25% 0px",
        threshold: 0,
      },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [fileUrl, isAnimatableAttachment, isImage, id, fileType]);

  const imagePreviewSrc =
    !isImage || !fileUrl
      ? null
      : shouldForceOriginal
        ? fileUrl
        : optimizedStillSrc;

  const showGroupedStartChrome =
    groupedTextBubble && showGroupedHeader && hideAvatarColumn && !isCompact;
  const shouldRenderReplyPreviewInsideTextBubble = Boolean(
    replyTo && !fileUrl && !sticker && !isEditing,
  );
  const canRenderCustomTextBubbleSurface =
    !groupedTextBubble && !(textBubbleGroupPosition === undefined && isCompact);
  const textBubbleSurfaceStyle = useMemo(() => {
    if (!canRenderCustomTextBubbleSurface) return undefined;
    return getChatBubbleSurfaceStyle(authorProfile?.chatBubbleStyle, {
      position: textBubbleGroupPosition,
      themeMode: (resolvedTheme as "dark" | "light") || "dark",
    });
  }, [
    authorProfile?.chatBubbleStyle,
    canRenderCustomTextBubbleSurface,
    textBubbleGroupPosition,
    resolvedTheme,
  ]);
  const effectiveHovered = isHovered || forcedHovered;

  return (
    <div
      ref={rootRef}
      data-message-id={id}
      data-message-compact={messageCompactData}
      data-compact-revision={compactRevisionData}
      className={cn(
        "relative group flex items-center hover:bg-black/5 transition",
        groupedTextBubble
          ? externalHoverArea
            ? GROUPED_TEXT_BUBBLE_EXTERNAL_HOVER_CLASS
            : "w-full py-0 px-0"
          : isCompact
            ? "py-0.5 pl-2 pr-2"
            : cn("w-full px-2", sticker && "pb-1"),
        isOptimistic && !isFailed && "opacity-50",
        isFailed && "bg-red-950/40",
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <AvatarGroupHoverContext.Provider value={effectiveHovered}>
        {showGroupedStartChrome && (
          <div
            data-chat-item-block="grouped-start-avatar"
            className="absolute left-2 top-0 shrink-0 pt-3"
          >
            {canOpenAuthorProfile ? (
              <UserAvatarMenu
                profileId={authorProfile?.id || ""}
                profileImageUrl={authorProfile?.imageUrl || ""}
                username={authorProfile?.username || ""}
                discriminator={authorProfile?.discriminator}
                currentProfileId={currentProfile.id}
                currentProfile={currentProfile}
                memberId={member?.id || undefined}
                showStatus={false}
                usernameColor={authorProfile?.usernameColor}
                usernameFormat={authorProfile?.usernameFormat}
                avatarAnimationMode="onHover"
                className="h-9 w-9"
              />
            ) : (
              <UserAvatar
                src={authorProfile?.imageUrl || undefined}
                profileId={authorProfile?.id}
                showStatus={false}
                className="h-9 w-9"
              />
            )}
          </div>
        )}

        <div
          data-chat-item-block="row"
          className={cn(
            "group flex gap-x-2 items-start",
            groupedTextBubble ? "w-full" : "w-full",
          )}
        >
          {/* Avatar - only show if not compact */}
          {!showGroupedStartChrome && !hideAvatarColumn && !isCompact ? (
            <div data-chat-item-block="avatar" className="shrink-0 pt-3">
              {canOpenAuthorProfile ? (
                <UserAvatarMenu
                  profileId={authorProfile?.id || ""}
                  profileImageUrl={authorProfile?.imageUrl || ""}
                  username={authorProfile?.username || ""}
                  discriminator={authorProfile?.discriminator}
                  currentProfileId={currentProfile.id}
                  currentProfile={currentProfile}
                  memberId={member?.id || undefined}
                  showStatus={false}
                  usernameColor={authorProfile?.usernameColor}
                  usernameFormat={authorProfile?.usernameFormat}
                  avatarAnimationMode="onHover"
                  className="h-9 w-9"
                />
              ) : (
                <UserAvatar
                  src={authorProfile?.imageUrl || undefined}
                  profileId={authorProfile?.id}
                  showStatus={false}
                  className="h-9 w-9"
                />
              )}
            </div>
          ) : !hideAvatarColumn ? (
            <div
              data-chat-item-block="avatar-placeholder"
              className="w-9 shrink-0"
            />
          ) : null}

          <div
            data-chat-item-block="col"
            className={cn(
              "flex min-w-0 flex-col overflow-hidden w-full",
              !isCompact && "pt-0.5",
            )}
          >
            {/* Reply Preview */}
            {replyTo && !shouldRenderReplyPreviewInsideTextBubble && (
              <ReplyPreview
                replyTo={replyTo}
                t={t}
                groupedTextBubble={groupedTextBubble}
                isCompact={isCompact}
              />
            )}

            {/* Image */}
            {isImage && fileUrl && (
              <>
                {!isCompact && (
                  <div
                    data-chat-item-block="image-header"
                    className="flex items-center gap-1 mb-0"
                  >
                    {(authorProfile?.badge ||
                      authorProfile?.badgeStickerUrl) && (
                      <>
                        <span className="inline-flex items-center gap-0.5">
                          {authorProfile?.badgeStickerUrl && (
                            <AnimatedSticker
                              src={authorProfile.badgeStickerUrl}
                              alt="badge"
                              containerClassName="h-5 w-5"
                              fallbackWidthPx={20}
                              fallbackHeightPx={20}
                              className="object-contain"
                              isHovered={effectiveHovered}
                            />
                          )}
                          {authorProfile?.badge && (
                            <span className="text-[12px] leading-none text-theme-text-tertiary pt-2.5">
                              {authorProfile.badge}
                            </span>
                          )}
                        </span>
                        <span className="text-[12px] text-theme-text-tertiary pt-2.5">
                          |
                        </span>
                      </>
                    )}
                    <span className="text-[12px] text-theme-text-tertiary pt-2.5">
                      {timestamp}
                    </span>
                  </div>
                )}

                {!isCompact && (
                  <div
                    data-chat-item-block="image-username"
                    className="flex items-center -mt-0.5"
                  >
                    <ProfileNameTrigger
                      canOpenAuthorProfile={canOpenAuthorProfile}
                      authorProfile={authorProfile}
                      currentProfile={currentProfile}
                      memberId={member?.id || undefined}
                      isOptimistic={isOptimistic}
                      isFailed={isFailed}
                      isOwnMessage={isOwnMessage}
                      resolvedTheme={resolvedTheme}
                    />
                  </div>
                )}

                <button
                  ref={attachmentButtonRef}
                  type="button"
                  onClick={() => setIsImageViewerOpen(true)}
                  className="mt-1 self-start block w-full max-w-full overflow-hidden rounded-md border bg-black/[0.03] cursor-pointer"
                  style={imageFrameStyle}
                  data-attachment-animatable={
                    isAnimatableAttachment ? "1" : "0"
                  }
                  data-attachment-in-band={isAttachmentInCenterBand ? "1" : "0"}
                  data-chat-item-block="image"
                >
                  {isAnimatableAttachment ? (
                    <div className="relative" style={imageFrameStyle}>
                      <span
                        ref={attachmentCenterSentinelRef}
                        aria-hidden="true"
                        className="pointer-events-none absolute left-1/2 top-1/2 h-px w-px -translate-x-1/2 -translate-y-1/2"
                      />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={effectiveAttachmentUrl || fileUrl}
                        alt={fileName || content || "attachment"}
                        onError={() => {
                          if (!fileUrl) return;
                          // If Express media previews fail (404/500/etc), fall back to the backend-provided
                          // static/preview URLs (imgproxy direct) instead of forcing the original animated URL.
                          setDisableExpressAttachmentPreviews({
                            url: fileUrl,
                            value: true,
                          });
                          // Clear any cached displayed URL so we can fall back immediately.
                          setAttachmentDisplayedUrlState(null);
                          attachmentSwapTokenRef.current += 1;
                        }}
                        className="absolute inset-0 h-full w-full object-contain"
                        loading="eager"
                        decoding="async"
                      />
                    </div>
                  ) : (
                    <div className="relative" style={imageFrameStyle}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreviewSrc || fileUrl}
                        alt={fileName || content || "attachment"}
                        onError={() => {
                          if (!fileUrl) return;
                          setForceOriginalImage({ url: fileUrl, value: true });
                        }}
                        className="absolute inset-0 h-full w-full object-contain"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  )}
                </button>

                <ImageViewerDialog
                  open={isImageViewerOpen}
                  onOpenChange={setIsImageViewerOpen}
                  fileUrl={fileUrl}
                  fileName={fileName}
                  content={content}
                  imageViewerContainerRef={imageViewerContainerRef}
                  imageViewerImgRef={imageViewerImgRef}
                  imageViewerScale={imageViewerScale}
                  imageViewerTranslate={imageViewerTranslate}
                  isImageViewerPanning={isImageViewerPanning}
                  handleImageViewerPointerDown={handleImageViewerPointerDown}
                  handleImageViewerPointerMove={handleImageViewerPointerMove}
                  handleImageViewerPointerUp={handleImageViewerPointerUp}
                />
              </>
            )}

            {/* Sticker */}
            {sticker && (
              <>
                {/* Badge + Timestamp row above sticker - only if not compact */}
                {!isCompact && (
                  <div
                    data-chat-item-block="sticker-header"
                    className="flex items-center gap-1 mb-0"
                  >
                    {(authorProfile?.badge ||
                      authorProfile?.badgeStickerUrl) && (
                      <>
                        <span className="inline-flex items-center gap-0.5">
                          {authorProfile?.badgeStickerUrl && (
                            <AnimatedSticker
                              src={authorProfile.badgeStickerUrl}
                              alt="badge"
                              containerClassName="h-5 w-5"
                              fallbackWidthPx={20}
                              fallbackHeightPx={20}
                              className="object-contain"
                              isHovered={effectiveHovered}
                            />
                          )}
                          {authorProfile?.badge && (
                            <span className="text-[12px] leading-none text-theme-text-tertiary pt-2.5">
                              {authorProfile.badge}
                            </span>
                          )}
                        </span>
                        <span className="text-[12px] text-theme-text-tertiary pt-2.5">
                          |
                        </span>
                      </>
                    )}
                    <span className="text-[12px] text-theme-text-tertiary pt-2.5">
                      {timestamp}
                    </span>
                  </div>
                )}
                {/* Username for sticker - only if not compact */}
                {!isCompact && (
                  <div
                    data-chat-item-block="sticker-username"
                    className="flex items-center -mt-0.5"
                  >
                    <ProfileNameTrigger
                      canOpenAuthorProfile={canOpenAuthorProfile}
                      authorProfile={authorProfile}
                      currentProfile={currentProfile}
                      memberId={member?.id || undefined}
                      isOptimistic={isOptimistic}
                      isFailed={isFailed}
                      isOwnMessage={isOwnMessage}
                      resolvedTheme={resolvedTheme}
                    />
                  </div>
                )}
                <div className="mt-1 -ml-2" data-chat-item-block="sticker">
                  <div
                    className={cn(
                      "relative h-32 w-32",
                      isFailed && "opacity-50",
                    )}
                  >
                    <AnimatedSticker
                      src={sticker.asset?.url || ""}
                      alt={sticker.name}
                      containerClassName="h-full w-full"
                      fallbackWidthPx={128}
                      fallbackHeightPx={128}
                      isHovered={effectiveHovered}
                    />
                  </div>
                  {canRetry && (
                    <button
                      type="button"
                      onClick={handleRetry}
                      disabled={isRetrying}
                      className="mt-1 text-[11px] text-red-400 hover:text-red-300 underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isRetrying
                        ? `(${t.chat.retrying})`
                        : `(${t.chat.retry})`}
                    </button>
                  )}
                </div>
              </>
            )}

            {/* PDF */}
            {isPDF && fileUrl && (
              <div
                data-chat-item-block="pdf"
                className="relative flex items-center p-2 mt-2 rounded-md bg-background/10"
              >
                <FileIcon className="h-10 w-10 fill-indigo-200 stroke-indigo-400" />
                <div className="ml-2 flex-1">
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-400 hover:underline"
                  >
                    {fileName || "PDF"}
                  </a>
                  <p className="text-xs text-gray-500">
                    {fileSize && `${(fileSize / 1024 / 1024).toFixed(2)} MB`}
                  </p>
                </div>
              </div>
            )}

            {/* Text content (not editing) */}
            {!fileUrl && !isEditing && !sticker && (
              <>
                {/* Badge + Timestamp row above message - only if not compact */}
                {!isCompact && (!groupedTextBubble || showGroupedHeader) && (
                  <div
                    data-chat-item-block="text-header"
                    className={cn(
                      "flex items-center gap-1 mb-0",
                      authorProfile?.badgeStickerUrl && "min-h-[28.5px]",
                    )}
                  >
                    {(authorProfile?.badge ||
                      authorProfile?.badgeStickerUrl) && (
                      <>
                        <span className="inline-flex items-center gap-0.5">
                          {authorProfile?.badgeStickerUrl && (
                            <AnimatedSticker
                              src={authorProfile.badgeStickerUrl}
                              alt="badge"
                              containerClassName="h-5 w-5"
                              fallbackWidthPx={20}
                              fallbackHeightPx={20}
                              className="object-contain"
                              isHovered={effectiveHovered}
                            />
                          )}
                          {authorProfile?.badge && (
                            <span className="text-[12px] leading-none text-theme-text-tertiary pt-2.5">
                              {authorProfile.badge}
                            </span>
                          )}
                        </span>
                        <span className="text-[12px] text-theme-text-tertiary pt-2.5">
                          |
                        </span>
                      </>
                    )}
                    <span className="text-[12px] text-theme-text-tertiary pt-2.5">
                      {timestamp}
                    </span>
                  </div>
                )}
                <div
                  data-chat-item-block="text-bubble"
                  className={cn(
                    groupedTextBubble &&
                      "mt-1 w-fit max-w-full border-0 bg-transparent shadow-none",
                    groupedTextBubble &&
                      textBubbleGroupPosition === "start" &&
                      "px-3 pt-2",
                    groupedTextBubble &&
                      textBubbleGroupPosition === "middle" &&
                      "px-3",
                    groupedTextBubble &&
                      textBubbleGroupPosition === "end" &&
                      "px-3 pb-2",
                    groupedTextBubble &&
                      textBubbleGroupPosition !== "start" &&
                      textBubbleGroupPosition !== "middle" &&
                      textBubbleGroupPosition !== "end" &&
                      "px-3",
                    !groupedTextBubble &&
                      textBubbleGroupPosition === "start" &&
                      cn(
                        "mt-1 self-start max-w-full px-3 pt-2 pb-1",
                        !textBubbleSurfaceStyle &&
                          "bg-theme-bg-overlay-primary",
                      ),
                    !groupedTextBubble &&
                      textBubbleGroupPosition === "middle" &&
                      cn(
                        "self-start max-w-full px-3 py-1",
                        !textBubbleSurfaceStyle &&
                          "bg-theme-bg-overlay-primary",
                      ),
                    !groupedTextBubble &&
                      textBubbleGroupPosition === "end" &&
                      cn(
                        "self-start max-w-full px-3 pt-1 pb-2",
                        !textBubbleSurfaceStyle &&
                          "bg-theme-bg-overlay-primary",
                      ),
                    !groupedTextBubble &&
                      textBubbleGroupPosition === "single" &&
                      cn(
                        "mt-[5px] self-start max-w-full px-3 py-2",
                        !textBubbleSurfaceStyle &&
                          "rounded-md bg-theme-bg-overlay-primary",
                      ),
                    !groupedTextBubble &&
                      textBubbleGroupPosition === undefined &&
                      (isCompact
                        ? "mt-0"
                        : cn(
                            "mt-[5px] self-start max-w-full px-3 py-2",
                            !textBubbleSurfaceStyle &&
                              "rounded-md bg-theme-bg-overlay-primary",
                          )),
                  )}
                  style={textBubbleSurfaceStyle}
                >
                  {replyTo && shouldRenderReplyPreviewInsideTextBubble && (
                    <ReplyPreview
                      replyTo={replyTo}
                      t={t}
                      groupedTextBubble={groupedTextBubble}
                      isCompact={isCompact}
                      insideBubble
                      groupedStartInsideBubble={
                        groupedTextBubble && showGroupedHeader
                      }
                    />
                  )}
                  <MessageContent
                    content={content}
                    deleted={deleted}
                    isUpdated={isUpdated}
                    isOptimistic={isOptimistic}
                    isFailed={isFailed}
                    t={t}
                    failedAction={
                      canRetry ? (
                        <button
                          type="button"
                          onClick={handleRetry}
                          disabled={isRetrying}
                          className="ml-2 text-[11px] text-red-400 hover:text-red-300 underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isRetrying
                            ? `(${t.chat.retrying})`
                            : `(${t.chat.retry})`}
                        </button>
                      ) : null
                    }
                    inlineUsername={
                      !isCompact ? (
                        <span
                          data-chat-item-block="inline-username"
                          className="whitespace-nowrap"
                        >
                          <span className="whitespace-nowrap">
                            <ProfileNameTrigger
                              canOpenAuthorProfile={canOpenAuthorProfile}
                              authorProfile={authorProfile}
                              currentProfile={currentProfile}
                              memberId={member?.id || undefined}
                              isOptimistic={isOptimistic}
                              isFailed={isFailed}
                              isOwnMessage={isOwnMessage}
                              resolvedTheme={resolvedTheme}
                            />
                          </span>
                          {"\u00A0"}
                        </span>
                      ) : undefined
                    }
                  />
                </div>
              </>
            )}

            {/* Reactions */}
            {!deleted && !isOptimistic && (
              <div
                data-chat-item-block="reactions"
                className={cn(groupedTextBubble && "ml-2")}
              >
                <MessageReactionsDisplay
                  messageId={isChannel ? id : undefined}
                  directMessageId={!isChannel ? id : undefined}
                  reactions={reactions}
                  currentProfileId={currentProfile.id}
                  channelId={channelId}
                  conversationId={conversationId}
                />
              </div>
            )}

            {/* Edit form - lazy loaded */}
            {!fileUrl && isEditing && (
              <div data-chat-item-block="edit-form">
                <Suspense fallback={<div className="h-20" />}>
                  <ChatItemEditForm
                    id={id}
                    content={content}
                    apiUrl={apiUrl}
                    socketQuery={socketQuery}
                    currentProfile={currentProfile}
                    onCancel={handleCancelEdit}
                  />
                </Suspense>
              </div>
            )}
          </div>
        </div>
      </AvatarGroupHoverContext.Provider>

      {/* Actions toolbar - lazy loaded only when hovered or menu is open */}
      {showActions && effectiveHovered && (
        <Suspense fallback={null}>
          <ChatItemActions
            id={id}
            isChannel={isChannel}
            messageSenderId={messageSenderId}
            content={content}
            attachmentAsset={attachmentAsset}
            sticker={sticker}
            reactions={reactions}
            deleted={deleted}
            currentProfile={currentProfile}
            currentMember={currentMember}
            member={member}
            authorProfile={canOpenAuthorProfile ? authorProfile : null}
            apiUrl={apiUrl}
            socketQuery={socketQuery}
            pinned={pinned}
            isLastMessage={isLastMessage}
            onStartEdit={handleStartEdit}
          />
        </Suspense>
      )}
    </div>
  );
};

// Aggressive memoization with custom comparator
export const ChatItemOptimized = memo(
  ChatItemOptimizedComponent,
  (prev, next) => {
    const prevReactions = prev.reactions || [];
    const nextReactions = next.reactions || [];

    const reactionsEqual =
      prevReactions.length === nextReactions.length &&
      prevReactions.every((r, i) => {
        const n = nextReactions[i];
        return (
          n &&
          r.id === n.id &&
          r.emoji === n.emoji &&
          r.profileId === n.profileId
        );
      });

    const replyEqual =
      prev.replyTo?.id === next.replyTo?.id &&
      prev.replyTo?.content === next.replyTo?.content &&
      prev.replyTo?.attachmentAsset?.id === next.replyTo?.attachmentAsset?.id &&
      prev.replyTo?.sticker?.id === next.replyTo?.sticker?.id;

    const prevProfile = prev.author;
    const nextProfile = next.author;

    const profileEqual =
      prevProfile?.id === nextProfile?.id &&
      prevProfile?.username === nextProfile?.username &&
      prevProfile?.discriminator === nextProfile?.discriminator &&
      prevProfile?.avatarAsset?.id === nextProfile?.avatarAsset?.id &&
      prevProfile?.badge === nextProfile?.badge &&
      prevProfile?.badgeSticker?.id === nextProfile?.badgeSticker?.id &&
      JSON.stringify(prevProfile?.chatBubbleStyle) ===
        JSON.stringify(nextProfile?.chatBubbleStyle) &&
      JSON.stringify(prevProfile?.usernameColor) ===
        JSON.stringify(nextProfile?.usernameColor) &&
      JSON.stringify(prevProfile?.usernameFormat) ===
        JSON.stringify(nextProfile?.usernameFormat);

    // Only re-render if these specific props change
    return (
      prev.id === next.id &&
      prev.isChannel === next.isChannel &&
      prev.messageSenderId === next.messageSenderId &&
      prev.content === next.content &&
      prev.deleted === next.deleted &&
      prev.isUpdated === next.isUpdated &&
      prev.isOptimistic === next.isOptimistic &&
      prev.isFailed === next.isFailed &&
      prev.pinned === next.pinned &&
      prev.isCompact === next.isCompact &&
      prev.isLastMessage === next.isLastMessage &&
      prev.textBubbleGroupPosition === next.textBubbleGroupPosition &&
      prev.groupedTextBubble === next.groupedTextBubble &&
      prev.hideAvatarColumn === next.hideAvatarColumn &&
      prev.showGroupedHeader === next.showGroupedHeader &&
      prev.externalHoverArea === next.externalHoverArea &&
      prev.messageCompactData === next.messageCompactData &&
      prev.compactRevisionData === next.compactRevisionData &&
      prev.forcedHovered === next.forcedHovered &&
      reactionsEqual &&
      prev.attachmentAsset?.id === next.attachmentAsset?.id &&
      prev.filePreviewUrl === next.filePreviewUrl &&
      prev.fileStaticPreviewUrl === next.fileStaticPreviewUrl &&
      prev.sticker?.id === next.sticker?.id &&
      replyEqual &&
      profileEqual
    );
  },
);
