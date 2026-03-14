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
} from "react";
import { Member, MemberRole, Profile } from "@prisma/client";
import { UserAvatarMenu } from "../user-avatar-menu";
import { FileIcon } from "lucide-react";
import { AnimatedSticker } from "@/components/ui/animated-sticker";
import { cn } from "@/lib/utils";
import { MessageReactionsDisplay } from "./message-reactions";
import { parseMentions } from "@/lib/parse-mentions";
import { ParsedMessageContent } from "@/lib/parse-invite-links";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/i18n";
import { useTheme } from "next-themes";
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
import { useTokenGetter } from "@/components/providers/token-manager-provider";
import { getExpressAuthHeaders } from "@/lib/express-fetch";

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
  member?: Member & { profile: Profile };
  sender: Profile;
  timestamp: string;
  fileUrl: string | null;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  fileWidth?: number | null;
  fileHeight?: number | null;
  filePreviewUrl?: string | null;
  fileStaticPreviewUrl?: string | null;
  sticker?: {
    id: string;
    imageUrl: string;
    name: string;
  } | null;
  reactions?: Array<{
    id: string;
    emoji: string;
    profileId: string;
    profile: {
      id: string;
      username: string;
      imageUrl: string;
    };
  }>;
  deleted: boolean;
  currentProfile: ClientProfile;
  currentMember?: Member | null;
  isUpdated: boolean;
  isOptimistic?: boolean;
  isFailed?: boolean;
  tempId?: string;
  apiUrl: string;
  socketQuery: Record<string, string>;
  replyTo?: {
    id: string;
    content: string;
    sender: Profile;
    member?: Member & { profile: Profile };
    fileUrl?: string | null;
    fileName?: string | null;
    sticker?: {
      id: string;
      imageUrl: string;
      name: string;
    } | null;
  } | null;
  pinned?: boolean;
  isCompact?: boolean;
  isLastMessage?: boolean;
}

const MAX_CHAT_IMAGE_PREVIEW_WIDTH = 250;
const MAX_CHAT_IMAGE_PREVIEW_HEIGHT = 295;
const FALLBACK_CHAT_IMAGE_PREVIEW_SIZE = { width: 224, height: 168 };

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

function getConstrainedImageSize(
  originalWidth: number,
  originalHeight: number,
  options?: { allowUpscale?: boolean },
) {
  if (!originalWidth || !originalHeight) {
    return FALLBACK_CHAT_IMAGE_PREVIEW_SIZE;
  }

  const scaleDownOrUp = Math.min(
    MAX_CHAT_IMAGE_PREVIEW_WIDTH / originalWidth,
    MAX_CHAT_IMAGE_PREVIEW_HEIGHT / originalHeight,
  );
  const scale = options?.allowUpscale
    ? scaleDownOrUp
    : Math.min(scaleDownOrUp, 1);

  return {
    width: Math.max(1, Math.round(originalWidth * scale)),
    height: Math.max(1, Math.round(originalHeight * scale)),
  };
}

// Reply preview - extracted for clarity
const ReplyPreview = memo(function ReplyPreview({
  replyTo,
  isChannel,
  t,
}: {
  replyTo: NonNullable<ChatItemOptimizedProps["replyTo"]>;
  isChannel: boolean;
  t: ReturnType<typeof useTranslation>["t"];
}) {
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
      className="mt-1 mb-2 pl-2.5 border-l-2 border-theme-border-accent-item-reply-preview"
    >
      <div className="text-xs text-theme-text-tertiary break-words">
        <span className="font-semibold">
          {isChannel
            ? replyTo.member?.profile.username
            : replyTo.sender.username}
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
        "text-sm text-theme-text-secondary whitespace-pre-wrap [overflow-wrap:anywhere]",
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

const ChatItemOptimizedComponent = ({
  id,
  content,
  member,
  sender,
  timestamp,
  fileUrl,
  fileName,
  fileType,
  fileSize,
  fileWidth = null,
  fileHeight = null,
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
  const [imagePreviewSize, setImagePreviewSize] = useState<{
    url: string;
    width: number;
    height: number;
  } | null>(null);

  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const getToken = useTokenGetter();
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

  const isChannel = !!member;
  const channelId = socketQuery.channelId as string | undefined;
  const conversationId = socketQuery.conversationId as string | undefined;
  const authorProfile = isChannel ? member!.profile : sender;

  const isOwnMessage = isChannel
    ? currentMember?.id === member?.id
    : currentProfile.id === sender.id;

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
      } else {
        payload.content = effectiveData.content;
        if (effectiveData.replyToId) {
          payload.replyToId = effectiveData.replyToId;
        }
      }

      const token = await getToken();
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          ...getExpressAuthHeaders(effectiveData.profileId, token),
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
    sticker,
    apiUrl,
    socketQuery,
    currentProfile,
    replyTo?.id,
    removeOptimisticMessage,
    removeRetryData,
    addOptimisticMessage,
    setRetryData,
    getToken,
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
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

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
    [imageViewerScale, imageViewerTranslate.x, imageViewerTranslate.y],
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

  const handleImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      if (!fileUrl) return;
      if (
        typeof fileWidth === "number" &&
        fileWidth > 0 &&
        typeof fileHeight === "number" &&
        fileHeight > 0
      ) {
        // Dimensions provided by backend: keep layout stable and avoid client-side re-measurement.
        return;
      }

      // For animatable attachments we may load a small static preview (imgproxy) first and then
      // swap to the original animated asset. Allowing upscale keeps the rendered box stable.
      const allowUpscale =
        fileType === "image/webp" ||
        fileType === "image/gif" ||
        fileType === "image/apng" ||
        looksLikeAnimatableImage(fileUrl);

      const nextSize = getConstrainedImageSize(
        event.currentTarget.naturalWidth,
        event.currentTarget.naturalHeight,
        { allowUpscale },
      );

      setImagePreviewSize((prev) => {
        if (
          prev &&
          prev.url === fileUrl &&
          prev.width === nextSize.width &&
          prev.height === nextSize.height
        ) {
          return prev;
        }

        return { url: fileUrl, ...nextSize };
      });
    },
    [fileHeight, fileType, fileUrl, fileWidth, id],
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

    return getConstrainedImageSize(fileWidth, fileHeight, { allowUpscale });
  }, [fileHeight, fileType, fileUrl, fileWidth]);

  const resolvedImageSize =
    serverProvidedImageSize ||
    (imagePreviewSize && fileUrl && imagePreviewSize.url === fileUrl
      ? imagePreviewSize
      : FALLBACK_CHAT_IMAGE_PREVIEW_SIZE);

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

  const attachmentAnimatedPreviewUrl = useMemo(() => {
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
    )}&w=${width}&h=${height}&q=85&fmt=webp&animated=true`;
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

        const rect = entry.boundingClientRect;
        const centerY = rect.top + rect.height / 2;
        const vh = typeof window !== "undefined" ? window.innerHeight || 0 : 0;
        const bandTop = vh * 0.35;
        const bandBottom = vh * 0.65;

        // eslint-disable-next-line no-console
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

  return (
    <div
      ref={rootRef}
      data-message-id={id}
      className={cn(
        "relative group flex items-center hover:bg-black/5 transition w-full",
        isCompact ? "py-0.5 pl-0 pr-2" : "px-2",
        isOptimistic && !isFailed && "opacity-50",
        isFailed && "bg-red-950/40",
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        data-chat-item-block="row"
        className={cn("group flex gap-x-2 w-full", "items-start")}
      >
        {/* Avatar - only show if not compact */}
        {!isCompact ? (
          <div data-chat-item-block="avatar" className="shrink-0 pt-3">
            <UserAvatarMenu
              profileId={authorProfile?.id || ""}
              profileImageUrl={authorProfile?.imageUrl || ""}
              username={authorProfile?.username || ""}
              discriminator={authorProfile?.discriminator}
              currentProfileId={currentProfile.id}
              currentProfile={currentProfile}
              memberId={member?.id}
              showStatus={false}
              usernameColor={authorProfile?.usernameColor}
              usernameFormat={authorProfile?.usernameFormat}
              avatarAnimationMode="onHover"
              avatarIsHovered={isHovered}
            />
          </div>
        ) : (
          <div
            data-chat-item-block="avatar-placeholder"
            className="w-10 shrink-0"
          />
        )}

        <div
          data-chat-item-block="col"
          className={cn(
            "flex flex-col w-full min-w-0 overflow-hidden",
            !isCompact && "pt-0.5",
          )}
        >
          {/* Reply Preview */}
          {replyTo && (
            <ReplyPreview replyTo={replyTo} isChannel={isChannel} t={t} />
          )}

          {/* Image */}
          {isImage && fileUrl && (
            <>
              <button
                ref={attachmentButtonRef}
                type="button"
                onClick={() => setIsImageViewerOpen(true)}
                className="mt-2 self-start inline-flex max-w-full overflow-hidden rounded-md border bg-secondary cursor-pointer"
                data-attachment-animatable={isAnimatableAttachment ? "1" : "0"}
                data-attachment-in-band={isAttachmentInCenterBand ? "1" : "0"}
                data-chat-item-block="image"
              >
                {isAnimatableAttachment ? (
                  <div
                    className="relative"
                    style={{
                      width: resolvedImageSize.width,
                      height: resolvedImageSize.height,
                    }}
                  >
                    <span
                      ref={attachmentCenterSentinelRef}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-1/2 top-1/2 h-px w-px -translate-x-1/2 -translate-y-1/2"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={effectiveAttachmentUrl || fileUrl}
                      alt={fileName || content || "attachment"}
                      onLoad={handleImageLoad}
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
                  <div
                    className="relative"
                    style={{
                      width: resolvedImageSize.width,
                      height: resolvedImageSize.height,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreviewSrc || fileUrl}
                      alt={fileName || content || "attachment"}
                      onLoad={handleImageLoad}
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

              <Dialog
                open={isImageViewerOpen}
                onOpenChange={setIsImageViewerOpen}
              >
                <DialogContent
                  showCloseButton={false}
                  // Keep DialogContent itself minimal; the actual viewer "stage" is fixed to the viewport.
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
                  {(authorProfile?.badge || authorProfile?.badgeStickerUrl) && (
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
                            isHovered={isHovered}
                          />
                        )}
                        {authorProfile?.badge && (
                          <span className="text-[11px] leading-none text-theme-text-tertiary pt-2.5">
                            {authorProfile.badge}
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] text-theme-text-tertiary pt-2.5">
                        |
                      </span>
                    </>
                  )}
                  <span className="text-[11px] text-theme-text-tertiary pt-2.5">
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
                  <UserAvatarMenu
                    profileId={authorProfile?.id || ""}
                    profileImageUrl={authorProfile?.imageUrl || ""}
                    username={authorProfile?.username || ""}
                    discriminator={authorProfile?.discriminator}
                    currentProfileId={currentProfile.id}
                    currentProfile={currentProfile}
                    memberId={member?.id}
                    showStatus={false}
                    usernameColor={authorProfile?.usernameColor}
                    usernameFormat={authorProfile?.usernameFormat}
                    hideAvatar
                  >
                    <span
                      className={cn(
                        "text-sm font-semibold text-white cursor-pointer hover:underline",
                        getUsernameFormatClasses(authorProfile?.usernameFormat),
                        isOptimistic && !isFailed && "text-theme-text-muted",
                        isFailed && "text-red-400",
                        getGradientAnimationClass(authorProfile?.usernameColor),
                      )}
                      style={getUsernameColorStyle(
                        authorProfile?.usernameColor,
                        {
                          isOwnProfile: isOwnMessage,
                          themeMode:
                            (resolvedTheme as "dark" | "light") || "dark",
                        },
                      )}
                    >
                      {authorProfile?.username}
                    </span>
                  </UserAvatarMenu>
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      getGradientAnimationClass(authorProfile?.usernameColor),
                    )}
                    style={getUsernameColorStyle(authorProfile?.usernameColor, {
                      isOwnProfile: isOwnMessage,
                      themeMode: (resolvedTheme as "dark" | "light") || "dark",
                    })}
                  >
                    :
                  </span>
                </div>
              )}
              <div className="mt-1" data-chat-item-block="sticker">
                <div
                  className={cn("relative h-32 w-32", isFailed && "opacity-50")}
                >
                  <AnimatedSticker
                    src={sticker.imageUrl}
                    alt={sticker.name}
                    containerClassName="h-full w-full"
                    fallbackWidthPx={128}
                    fallbackHeightPx={128}
                    isHovered={isHovered}
                  />
                </div>
                {canRetry && (
                  <button
                    type="button"
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="mt-1 text-[11px] text-red-400 hover:text-red-300 underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRetrying ? `(${t.chat.retrying})` : `(${t.chat.retry})`}
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
              {!isCompact && (
                <div
                  data-chat-item-block="text-header"
                  className="flex items-center gap-1 mb-0"
                >
                  {(authorProfile?.badge || authorProfile?.badgeStickerUrl) && (
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
                            isHovered={isHovered}
                          />
                        )}
                        {authorProfile?.badge && (
                          <span className="text-[11px] leading-none text-theme-text-tertiary pt-2.5">
                            {authorProfile.badge}
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] text-theme-text-tertiary pt-2.5">
                        |
                      </span>
                    </>
                  )}
                  <span className="text-[11px] text-theme-text-tertiary pt-2.5">
                    {timestamp}
                  </span>
                </div>
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
                    <>
                      <span className="whitespace-nowrap">
                        <UserAvatarMenu
                          profileId={authorProfile?.id || ""}
                          profileImageUrl={authorProfile?.imageUrl || ""}
                          username={authorProfile?.username || ""}
                          discriminator={authorProfile?.discriminator}
                          currentProfileId={currentProfile.id}
                          currentProfile={currentProfile}
                          memberId={member?.id}
                          showStatus={false}
                          usernameColor={authorProfile?.usernameColor}
                          usernameFormat={authorProfile?.usernameFormat}
                          hideAvatar
                        >
                          <span
                            data-chat-item-block="text-username"
                            className={cn(
                              "text-sm font-semibold text-white cursor-pointer hover:underline",
                              getUsernameFormatClasses(
                                authorProfile?.usernameFormat,
                              ),
                              isOptimistic &&
                                !isFailed &&
                                "text-theme-text-muted",
                              isFailed && "text-red-400",
                              getGradientAnimationClass(
                                authorProfile?.usernameColor,
                              ),
                            )}
                            style={getUsernameColorStyle(
                              authorProfile?.usernameColor,
                              {
                                isOwnProfile: isOwnMessage,
                                themeMode:
                                  (resolvedTheme as "dark" | "light") || "dark",
                              },
                            )}
                          >
                            {authorProfile?.username}
                          </span>
                        </UserAvatarMenu>
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            getGradientAnimationClass(
                              authorProfile?.usernameColor,
                            ),
                          )}
                          style={getUsernameColorStyle(
                            authorProfile?.usernameColor,
                            {
                              isOwnProfile: isOwnMessage,
                              themeMode:
                                (resolvedTheme as "dark" | "light") || "dark",
                            },
                          )}
                        >
                          :
                        </span>
                      </span>
                      {"\u00A0"}
                    </>
                  ) : undefined
                }
              />
            </>
          )}

          {/* Reactions */}
          {!deleted && !isOptimistic && (
            <div data-chat-item-block="reactions">
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

      {/* Actions toolbar - lazy loaded only when hovered or menu is open */}
      {showActions && isHovered && (
        <Suspense fallback={null}>
          <ChatItemActions
            id={id}
            content={content}
            fileUrl={fileUrl}
            fileName={fileName}
            sticker={sticker}
            reactions={reactions}
            deleted={deleted}
            currentProfile={currentProfile}
            currentMember={currentMember}
            member={member}
            sender={sender}
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
      prev.replyTo?.fileUrl === next.replyTo?.fileUrl &&
      prev.replyTo?.fileName === next.replyTo?.fileName &&
      prev.replyTo?.sticker?.id === next.replyTo?.sticker?.id;

    // Compare sender/member profile fields that affect rendering
    const prevProfile = prev.member?.profile ?? prev.sender;
    const nextProfile = next.member?.profile ?? next.sender;

    const profileEqual =
      prevProfile?.id === nextProfile?.id &&
      prevProfile?.username === nextProfile?.username &&
      prevProfile?.discriminator === nextProfile?.discriminator &&
      prevProfile?.imageUrl === nextProfile?.imageUrl &&
      prevProfile?.badge === nextProfile?.badge &&
      prevProfile?.badgeStickerUrl === nextProfile?.badgeStickerUrl &&
      JSON.stringify(prevProfile?.usernameColor) ===
        JSON.stringify(nextProfile?.usernameColor) &&
      JSON.stringify(prevProfile?.usernameFormat) ===
        JSON.stringify(nextProfile?.usernameFormat);

    // Only re-render if these specific props change
    return (
      prev.id === next.id &&
      prev.content === next.content &&
      prev.deleted === next.deleted &&
      prev.isUpdated === next.isUpdated &&
      prev.isOptimistic === next.isOptimistic &&
      prev.isFailed === next.isFailed &&
      prev.pinned === next.pinned &&
      prev.isCompact === next.isCompact &&
      prev.isLastMessage === next.isLastMessage &&
      reactionsEqual &&
      prev.fileUrl === next.fileUrl &&
      prev.fileName === next.fileName &&
      prev.fileType === next.fileType &&
      prev.fileSize === next.fileSize &&
      prev.fileWidth === next.fileWidth &&
      prev.fileHeight === next.fileHeight &&
      prev.filePreviewUrl === next.filePreviewUrl &&
      prev.fileStaticPreviewUrl === next.fileStaticPreviewUrl &&
      prev.sticker?.id === next.sticker?.id &&
      replyEqual &&
      profileEqual
    );
  },
);
