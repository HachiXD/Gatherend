"use client";

// Types imported through hooks/chat
import { format, isToday, isYesterday } from "date-fns";
import { ServerCrash } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ChatWelcome } from "./chat-welcome";
import { ChatItemOptimized } from "./chat-item-optimized";
import { WelcomeMessageCard } from "./welcome-message-card";
import { ChatSkeleton } from "./chat-skeleton";
import { GoToRecentButton } from "./go-to-recent-button";

import {
  getMessageAuthor,
  getReplyAuthor,
  useChatMessageWindow,
  useScrollManager,
  ChannelMessage,
  ChatMessage,
  ChatMessagesProps,
  generateChatPlaceholderSpecs,
} from "@/hooks/chat";

import { chatScrollDimensionsStore } from "@/hooks/chat/chat-scroll-dimensions-store";

import { useTranslation } from "@/i18n";
import { useMountedChatRoom } from "@/hooks/use-chat-room-lifecycle-store";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useChannelData } from "@/hooks/use-board-data";
import { cn } from "@/lib/utils";
import {
  GROUPED_TEXT_BUBBLE_LEFT_SPACER_CLASS,
  GROUPED_TEXT_BUBBLE_ROW_CLASS,
} from "./chat-grouped-layout";
import {
  canUsePretextForGroupedBubbleMessage,
  measureGroupedTextBubbleGroup,
} from "./chat-text-bubble-pretext";
import { getChatBubbleSurfaceStyle } from "./chat-bubble-style-render";
import { useEffectiveThemeMode } from "@/hooks/use-effective-theme-config";

// CONSTANTS

const DATE_FORMAT = "d MMM yyyy, HH:mm";
const IGNORED_SCROLL_EVENTS_AFTER_PROGRAMMATIC = 2;
const PINNED_TO_BOTTOM_PX = 24;
const FALLBACK_PLACEHOLDER_HEIGHT_PX = 700;

// HELPERS

const formatMessageTimestamp = (date: Date): string => {
  if (isToday(date)) return format(date, "hh:mm a");
  if (isYesterday(date)) return `Yesterday, ${format(date, "hh:mm a")}`;
  return format(date, DATE_FORMAT);
};

function isTextBubbleGroupableMessage(message: ChatMessage): boolean {
  return (
    !("type" in message && message.type === "WELCOME") &&
    !message.attachmentAsset &&
    !message.sticker
  );
}

function getTextBubbleGroupPosition(
  messages: ChatMessage[],
  index: number,
  compactById: Record<string, boolean>,
): "single" | "start" | "middle" | "end" | undefined {
  const current = messages[index];
  if (!current || !isTextBubbleGroupableMessage(current)) return undefined;

  const prev = index > 0 ? messages[index - 1] : undefined;
  const next = index < messages.length - 1 ? messages[index + 1] : undefined;

  const currentCompact = compactById[current.id] ?? false;
  const continuesFromPrev =
    currentCompact && Boolean(prev && isTextBubbleGroupableMessage(prev));
  const nextGroupable = next ? isTextBubbleGroupableMessage(next) : false;
  const continuesToNext =
    nextGroupable && next ? (compactById[next.id] ?? false) : false;

  if (continuesFromPrev && continuesToNext) return "middle";
  if (continuesFromPrev) return "end";
  if (continuesToNext) return "start";
  if (!currentCompact) return "single";
  return undefined;
}

type MessageRenderNode =
  | { kind: "single"; message: ChatMessage; index: number }
  | {
      kind: "text-group";
      items: Array<{ message: ChatMessage; index: number }>;
    };

const ENABLE_PRETEXT_GROUPED_BUBBLE_LAYOUT = true;
const ENABLE_PRETEXT_GROUPED_BUBBLE_DOM_FALLBACK = true;

function getGroupedBubbleBoundsFromDom(node: HTMLElement | null) {
  if (!node) return undefined;

  console.log("[grouped-bubble-measure] dom-path:getGroupedBubbleBoundsFromDom");

  const containerRect = node.getBoundingClientRect();
  let width = 0;
  let minLeft = Number.POSITIVE_INFINITY;
  let minTop = Number.POSITIVE_INFINITY;
  let maxBottom = 0;

  const bubbles = Array.from(
    node.querySelectorAll<HTMLElement>('[data-chat-item-block="text-bubble"]'),
  );

  bubbles.forEach((bubble) => {
    const rect = bubble.getBoundingClientRect();
    width = Math.max(width, Math.ceil(rect.width));
    minLeft = Math.min(minLeft, Math.floor(rect.left - containerRect.left));
    minTop = Math.min(minTop, Math.floor(rect.top - containerRect.top));
    maxBottom = Math.max(maxBottom, Math.ceil(rect.bottom - containerRect.top));
  });

  if (!bubbles.length || width === 0) return undefined;

  return {
    width,
    left: Number.isFinite(minLeft) ? minLeft : 0,
    top: Number.isFinite(minTop) ? minTop : 0,
    height: Math.max(0, maxBottom - (Number.isFinite(minTop) ? minTop : 0)),
  };
}

function GroupedTextBubbleRow({
  msg,
  index,
  isStartItem,
  messages,
  compactById,
  compactRevision,
  renderMessage,
}: {
  msg: ChatMessage;
  index: number;
  isStartItem: boolean;
  messages: ChatMessage[];
  compactById: Record<string, boolean>;
  compactRevision: number;
  renderMessage: (
    msg: ChatMessage,
    index: number,
    messages: ChatMessage[],
    options?: {
      groupedTextBubble?: boolean;
      hideAvatarColumn?: boolean;
      showGroupedHeader?: boolean;
      externalHoverArea?: boolean;
      forcedHovered?: boolean;
      messageCompactData?: "0" | "1";
      compactRevisionData?: number;
    },
  ) => ReactNode;
}) {
  return (
    <div className={GROUPED_TEXT_BUBBLE_ROW_CLASS}>
      <div aria-hidden="true" className={GROUPED_TEXT_BUBBLE_LEFT_SPACER_CLASS} />
      <div className="min-w-0">
        {renderMessage(msg, index, messages, {
          groupedTextBubble: true,
          hideAvatarColumn: true,
          showGroupedHeader: isStartItem,
          externalHoverArea: true,
          messageCompactData: compactById[msg.id] ? "1" : "0",
          compactRevisionData: compactRevision,
        })}
      </div>
    </div>
  );
}

function GroupedTextBubbleRun({
  items,
  messages,
  compactById,
  compactRevision,
  deletedMemberLabel,
  fileLabel,
  stickerLabel,
  editedLabel,
  renderMessage,
}: {
  items: Array<{ message: ChatMessage; index: number }>;
  messages: ChatMessage[];
  compactById: Record<string, boolean>;
  compactRevision: number;
  deletedMemberLabel: string;
  fileLabel: string;
  stickerLabel: string;
  editedLabel: string;
  renderMessage: (
    msg: ChatMessage,
    index: number,
    messages: ChatMessage[],
    options?: {
      groupedTextBubble?: boolean;
      hideAvatarColumn?: boolean;
      showGroupedHeader?: boolean;
      externalHoverArea?: boolean;
      forcedHovered?: boolean;
      messageCompactData?: "0" | "1";
      compactRevisionData?: number;
    },
  ) => ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [contentWidthPx, setContentWidthPx] = useState(0);
  const [domBubbleBounds, setDomBubbleBounds] = useState<
    | {
        width: number;
        left: number;
        top: number;
        height: number;
      }
    | undefined
  >(undefined);
  const canUsePretextLayout = useMemo(
    () =>
      ENABLE_PRETEXT_GROUPED_BUBBLE_LAYOUT &&
      contentWidthPx > 0 &&
      items.every(({ message }) =>
        canUsePretextForGroupedBubbleMessage({
          content: message.content,
          deleted: message.deleted,
        }),
      ),
    [contentWidthPx, items],
  );

  const pretextBubbleBounds = useMemo(() => {
    if (!canUsePretextLayout) {
      console.log("[grouped-bubble-measure] pretext-path:skipped", {
        reason:
          contentWidthPx <= 0
            ? "content-width-not-ready"
            : "group-not-compatible",
        contentWidthPx,
        itemCount: items.length,
        compat: items.map(({ message }) => ({
          id: message.id,
          deleted: message.deleted,
          compatible: canUsePretextForGroupedBubbleMessage({
            content: message.content,
            deleted: message.deleted,
          }),
        })),
      });
      return undefined;
    }

    console.log("[grouped-bubble-measure] pretext-path:measure", {
      contentWidthPx,
      itemCount: items.length,
      itemIds: items.map(({ message }) => message.id),
    });

    return measureGroupedTextBubbleGroup({
      contentWidthPx,
      items: items.map(({ message }, itemIndex) => {
        const author = getMessageAuthor(message, {
          fallbackLabel: deletedMemberLabel,
        });
        const replyTo = message.replyTo
          ? {
              content: message.replyTo.content,
              sender: getReplyAuthor(message.replyTo, {
                fallbackLabel: deletedMemberLabel,
              }),
              fileUrl: message.replyTo.attachmentAsset?.url || null,
              fileName: message.replyTo.attachmentAsset?.originalName || null,
              sticker: message.replyTo.sticker,
            }
          : null;

        return {
          content: message.content,
          deleted: message.deleted,
          isUpdated: message.updatedAt !== message.createdAt,
          position:
            itemIndex === 0
              ? "start"
              : itemIndex === items.length - 1
                ? "end"
                : "middle",
          showGroupedHeader: itemIndex === 0,
          authorUsername: author?.username,
          authorHasBadgeSticker: Boolean(author?.badgeSticker?.asset?.url),
          replyTo,
          deletedMemberLabel,
          fileLabel,
          stickerLabel,
          editedLabel,
        };
      }),
    });
  }, [
    canUsePretextLayout,
    contentWidthPx,
    deletedMemberLabel,
    editedLabel,
    fileLabel,
    items,
    stickerLabel,
  ]);

  const resolvedTheme = useEffectiveThemeMode();
  const groupedBubbleSurfaceStyle = useMemo(() => {
    const author = getMessageAuthor(items[0]?.message, {
      fallbackLabel: deletedMemberLabel,
      includeFallback: false,
    });

    return getChatBubbleSurfaceStyle(author?.chatBubbleStyle, {
      groupedSurface: true,
      themeMode: (resolvedTheme as "dark" | "light") || "dark",
    });
  }, [deletedMemberLabel, items, resolvedTheme]);

  const bubbleBounds = pretextBubbleBounds ?? domBubbleBounds;

  useEffect(() => {
    console.log("[grouped-bubble-measure] bubble-bounds:active-path", {
      path: pretextBubbleBounds ? "pretext" : domBubbleBounds ? "dom" : "none",
      pretextBubbleBounds,
      domBubbleBounds,
      contentWidthPx,
      itemIds: items.map(({ message }) => message.id),
    });
  }, [contentWidthPx, domBubbleBounds, items, pretextBubbleBounds]);

  useEffect(() => {
    const node = contentRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      const nextWidth = Math.ceil(node.clientWidth);
      setContentWidthPx((prev) => (prev === nextWidth ? prev : nextWidth));

      if (!canUsePretextLayout && ENABLE_PRETEXT_GROUPED_BUBBLE_DOM_FALLBACK) {
        console.log("[grouped-bubble-measure] dom-path:resize-observer", {
          reason:
            nextWidth <= 0
              ? "content-width-not-ready"
              : "pretext-disabled-or-incompatible",
          nextWidth,
          canUsePretextLayout,
          itemIds: items.map(({ message }) => message.id),
        });
        const nextBounds = getGroupedBubbleBoundsFromDom(node);
        setDomBubbleBounds((prev) => {
          if (!nextBounds) return prev;
          if (
            prev?.width === nextBounds.width &&
            prev?.left === nextBounds.left &&
            prev?.top === nextBounds.top &&
            prev?.height === nextBounds.height
          ) {
            return prev;
          }
          return nextBounds;
        });
      } else {
        setDomBubbleBounds(undefined);
      }
    });

    const nextWidth = Math.ceil(node.clientWidth);
    setContentWidthPx((prev) => (prev === nextWidth ? prev : nextWidth));

    if (!canUsePretextLayout && ENABLE_PRETEXT_GROUPED_BUBBLE_DOM_FALLBACK) {
      console.log("[grouped-bubble-measure] dom-path:initial-effect", {
        reason:
          nextWidth <= 0
            ? "content-width-not-ready"
            : "pretext-disabled-or-incompatible",
        nextWidth,
        canUsePretextLayout,
        itemIds: items.map(({ message }) => message.id),
      });
      const nextBounds = getGroupedBubbleBoundsFromDom(node);
      setDomBubbleBounds((prev) => {
        if (!nextBounds) return prev;
        if (
          prev?.width === nextBounds.width &&
          prev?.left === nextBounds.left &&
          prev?.top === nextBounds.top &&
          prev?.height === nextBounds.height
        ) {
          return prev;
        }
        return nextBounds;
      });
    } else {
      setDomBubbleBounds(undefined);
    }

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [canUsePretextLayout, items]);

  return (
    <div>
      <div ref={contentRef} className="relative min-w-0 w-full">
        {bubbleBounds ? (
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute",
              !groupedBubbleSurfaceStyle &&
                "rounded-md bg-theme-bg-overlay-primary/72",
            )}
            style={{
              left: `${bubbleBounds.left}px`,
              top: `${bubbleBounds.top}px`,
              width: `${bubbleBounds.width}px`,
              height: `${bubbleBounds.height}px`,
              ...groupedBubbleSurfaceStyle,
            }}
          />
        ) : null}

        <div className="relative z-10 w-full">
          {items.map((item, itemIndex) => (
            <GroupedTextBubbleRow
              key={item.message.id}
              msg={item.message}
              index={item.index}
              isStartItem={itemIndex === 0}
              messages={messages}
              compactById={compactById}
              compactRevision={compactRevision}
              renderMessage={renderMessage}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function buildMessageRenderNodes(
  messages: ChatMessage[],
  compactById: Record<string, boolean>,
): MessageRenderNode[] {
  const nodes: MessageRenderNode[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const current = messages[index];
    if (!current) continue;

    const canStartTextGroup =
      isTextBubbleGroupableMessage(current) &&
      !(compactById[current.id] ?? false) &&
      index < messages.length - 1;

    if (!canStartTextGroup) {
      nodes.push({ kind: "single", message: current, index });
      continue;
    }

    const groupItems: Array<{ message: ChatMessage; index: number }> = [
      { message: current, index },
    ];
    let cursor = index + 1;

    while (cursor < messages.length) {
      const next = messages[cursor];
      if (
        !next ||
        !isTextBubbleGroupableMessage(next) ||
        !(compactById[next.id] ?? false)
      ) {
        break;
      }

      groupItems.push({ message: next, index: cursor });
      cursor += 1;
    }

    if (groupItems.length > 1) {
      nodes.push({ kind: "text-group", items: groupItems });
      index = cursor - 1;
    } else {
      nodes.push({ kind: "single", message: current, index });
    }
  }

  return nodes;
}

// COMPONENT

function ChatMessagesComponent({
  name,
  currentProfile,
  currentMember,
  board,
  apiUrl,
  socketQuery,
  paramKey,
  paramValue,
  type,
}: ChatMessagesProps) {
  const { t } = useTranslation();

  // REFS

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollContentRef = useRef<HTMLDivElement | null>(null);
  const [windowHeightPx, setWindowHeightPx] = useState(() => {
    if (typeof window === "undefined") return 0;
    return window.innerHeight;
  });
  const scrollContainerCallbackRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrollContainerRef.current = node;
    },
    [],
  );
  const scrollContentCallbackRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrollContentRef.current = node;
    },
    [],
  );
  const ignoredScrollEventsRef = useRef(0);
  const wheelRafRef = useRef<number | null>(null);

  const markProgrammaticScroll = useCallback(
    (count: number = IGNORED_SCROLL_EVENTS_AFTER_PROGRAMMATIC) => {
      ignoredScrollEventsRef.current = Math.max(
        ignoredScrollEventsRef.current,
        count,
      );
    },
    [],
  );

  // STORES

  const scrollTrigger = useScrollToBottom((state) => state.scrollTrigger);

  // VIEWPORT STATE

  const pinnedRef = useRef(true);
  const [pendingNewerMessages, setPendingNewerMessages] = useState(0);
  const windowKey = useMemo(
    () => `chatWindow:${type}:${paramValue}`,
    [paramValue, type],
  );

  // ROOM LIFECYCLE

  useMountedChatRoom(type, paramValue);

  // DATA LAYER

  const chatWindow = useChatMessageWindow({
    windowKey,
    apiUrl,
    paramKey,
    paramValue,
    profileId: currentProfile.id,
    boardId: board?.id,
  });

  const hasEvictedNewerLike = chatWindow.afterCount > 0;
  const hasEvictedOlderLike = chatWindow.beforeCount > 0;

  const showWelcome =
    chatWindow.status === "success" && !chatWindow.hasMoreBefore;
  const showTopSkeleton = !showWelcome && chatWindow.hasMoreBefore;
  const showBottomSkeleton = chatWindow.hasMoreAfter;
  const canPaginateUp = chatWindow.hasMoreBefore && !chatWindow.isFetchingOlder;
  const canPaginateDown =
    chatWindow.hasMoreAfter && !chatWindow.isFetchingNewer;

  // FLAGS (data-driven)

  // messages.hasMoreAfter: there are more recent messages
  // not represented in the current window (cache or server).
  const hasMoreRecent = chatWindow.hasMoreAfter;

  const prevCauseRef = useRef<{
    status: string;
    messageCount: number;
    isFetchingOlder: boolean;
    isFetchingNewer: boolean;
    hasEvictedNewerLike: boolean;
    hasEvictedOlderLike: boolean;
    hasMoreRecent: boolean;
    pendingNewerMessages: number;
    scrollTrigger: number;
    compactRevision: number;
  } | null>(null);

  const currentCause = {
    status: chatWindow.status,
    messageCount: chatWindow.messages.length,
    isFetchingOlder: chatWindow.isFetchingOlder,
    isFetchingNewer: chatWindow.isFetchingNewer,
    hasEvictedNewerLike,
    hasEvictedOlderLike,
    hasMoreRecent,
    pendingNewerMessages,
    scrollTrigger,
    compactRevision: chatWindow.compactRevision,
  };

  const changedCause: string[] = [];
  const prevCause = prevCauseRef.current;

  if (!prevCause || prevCause.status !== currentCause.status)
    changedCause.push("status");
  if (!prevCause || prevCause.messageCount !== currentCause.messageCount)
    changedCause.push("messageCount");
  if (!prevCause || prevCause.isFetchingOlder !== currentCause.isFetchingOlder)
    changedCause.push("isFetchingOlder");
  if (!prevCause || prevCause.isFetchingNewer !== currentCause.isFetchingNewer)
    changedCause.push("isFetchingNewer");
  if (
    !prevCause ||
    prevCause.hasEvictedNewerLike !== currentCause.hasEvictedNewerLike
  )
    changedCause.push("hasEvictedNewerLike");
  if (
    !prevCause ||
    prevCause.hasEvictedOlderLike !== currentCause.hasEvictedOlderLike
  )
    changedCause.push("hasEvictedOlderLike");
  if (!prevCause || prevCause.hasMoreRecent !== currentCause.hasMoreRecent)
    changedCause.push("hasMoreRecent");
  if (
    !prevCause ||
    prevCause.pendingNewerMessages !== currentCause.pendingNewerMessages
  )
    changedCause.push("pendingNewerMessages");
  if (!prevCause || prevCause.scrollTrigger !== currentCause.scrollTrigger)
    changedCause.push("scrollTrigger");
  if (!prevCause || prevCause.compactRevision !== currentCause.compactRevision)
    changedCause.push("compactRevision");

  prevCauseRef.current = currentCause;

  // MESSAGES (message-window model: already oldest -> newest)

  const messages = chatWindow.messages;

  const lastMessageId = useMemo(() => {
    const last = messages[messages.length - 1] as unknown as
      | { id?: string }
      | undefined;
    return last?.id ?? null;
  }, [messages]);

  // SCROLL STABILITY

  const didInitialScrollToBottomRef = useRef(false);
  const pendingScrollToBottomReasonRef = useRef<string | null>(null);
  const restoredRoomKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setWindowHeightPx(window.innerHeight);
    onResize();
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const placeholderSpecs = useMemo(() => {
    const effectiveWindowHeightPx =
      windowHeightPx ||
      (typeof window !== "undefined" ? window.innerHeight : 0);

    let fontSizePx = 16;
    try {
      const el = scrollContainerRef.current;
      if (el) {
        const cs = window.getComputedStyle(el);
        const parsed = Number.parseFloat(cs.fontSize);
        if (Number.isFinite(parsed) && parsed > 0) fontSizePx = parsed;
      }
    } catch {
      // ignore
    }

    if (!effectiveWindowHeightPx) return null;

    return generateChatPlaceholderSpecs({
      compact: false,
      fontSizePx,
      windowHeightPx: effectiveWindowHeightPx,
      groupSpacingPx: 16,
      strategy: "default",
    });
  }, [scrollContainerRef, windowHeightPx]);

  const placeholderHeightPx =
    placeholderSpecs?.totalHeightPx ?? FALLBACK_PLACEHOLDER_HEIGHT_PX;

  const scrollManagerMergeProps = useMemo(
    () => ({
      messages: {
        channelId: windowKey,
        ready: chatWindow.status === "success",
        loadingMore: chatWindow.isFetchingOlder || chatWindow.isFetchingNewer,
        hasMoreBefore: showTopSkeleton,
        hasMoreAfter: showBottomSkeleton,
        compactRevision: chatWindow.compactRevision,
      },
      placeholderHeight: placeholderHeightPx,
      canLoadMore: true,
      canPaginateTop: showTopSkeleton && canPaginateUp,
      canPaginateBottom: showBottomSkeleton && canPaginateDown,
      isFetchingTop: chatWindow.isFetchingOlder,
      isFetchingBottom: chatWindow.isFetchingNewer,
      loadMoreTop: () => chatWindow.loadOlder(),
      loadMoreBottom: () => chatWindow.loadNewer(),
    }),
    [
      canPaginateDown,
      canPaginateUp,
      chatWindow,
      placeholderHeightPx,
      showBottomSkeleton,
      showTopSkeleton,
      windowKey,
    ],
  );

  const scrollManager = useScrollManager(null, null, {
    dimensionsKey: windowKey,
    mergeProps: scrollManagerMergeProps,
    elementRefs: { container: scrollContainerRef, content: scrollContentRef },
  });

  useEffect(() => {
    scrollManager.setPinned(pinnedRef.current);
  }, [scrollManager]);

  // Apply initial scroll restore pre-paint to avoid a 1-frame "flash" at scrollTop=0 on mount.
  useLayoutEffect(() => {
    if (chatWindow.status !== "success") return;
    if (!scrollContainerRef.current) return;

    // Restore once per room key (not per render).
    if (restoredRoomKeyRef.current === windowKey) return;

    restoredRoomKeyRef.current = windowKey;
    didInitialScrollToBottomRef.current = true;

    const apply = () => {
      const scrollDims = chatScrollDimensionsStore.get(windowKey);

      // If we have no previous dims, default to bottom.
      const hasDims = scrollDims.updatedAt > 0;

      if (!hasDims || scrollDims.isPinned) {
        scrollManager.setPinned(true);
        pinnedRef.current = true;
        setPendingNewerMessages(0);
        scrollManager.scrollToBottom();
        markProgrammaticScroll();
        scrollManager.updateStoreDimensions();
        return;
      }

      // Dimensions are stored normalized (scrollTop/scrollHeight - placeholderHeight).
      // Restore by re-adding the current placeholderHeight.
      const target = scrollDims.normalizedScrollTop + placeholderHeightPx;
      scrollManager.setPinned(false);
      pinnedRef.current = false;

      scrollManager.scrollTo(target, "restore:dimensions");
      markProgrammaticScroll();
      scrollManager.updateStoreDimensions();
    };

    apply();
  }, [
    chatWindow.status,
    markProgrammaticScroll,
    placeholderHeightPx,
    scrollManager,
    windowKey,
  ]);

  useEffect(() => {
    const reason = pendingScrollToBottomReasonRef.current;
    if (!reason) return;
    if (chatWindow.status !== "success") return;
    if (!scrollContainerRef.current) return;

    pendingScrollToBottomReasonRef.current = null;

    // Wait for the commit/layout where messages are actually in the DOM.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollManager.scrollToBottom();
        markProgrammaticScroll();
      });
    });
  }, [chatWindow.status, markProgrammaticScroll, scrollManager]);

  // STICKY BOTTOM
  // - If user is pinned to bottom in "present mode", keep them pinned as new
  //   messages arrive or optimistic ids are replaced.
  // - Do not move the user in historical mode (hasMoreAfter).

  const lastStickySnapshotRef = useRef<{ len: number; lastId: string | null }>({
    len: 0,
    lastId: null,
  });
  useEffect(() => {
    if (chatWindow.status !== "success") return;
    if (!scrollContainerRef.current) return;
    if (!pinnedRef.current) return;
    if (hasMoreRecent) return;

    const prev = lastStickySnapshotRef.current;
    const next = { len: messages.length, lastId: lastMessageId };
    lastStickySnapshotRef.current = next;

    if (prev.len === next.len && prev.lastId === next.lastId) return;

    // Don't interfere with pagination restores (they are their own transaction).
    if (scrollManager.hasPendingRestore()) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollManager.scrollToBottom();
        markProgrammaticScroll();
      });
    });
  }, [
    chatWindow.status,
    hasMoreRecent,
    lastMessageId,
    markProgrammaticScroll,
    messages.length,
    scrollManager,
  ]);

  // RESET ON ROOM CHANGE

  useEffect(() => {
    pinnedRef.current = true;
    scrollManager.setPinned(true);
    setPendingNewerMessages(0);
    ignoredScrollEventsRef.current = 0;
    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramValue]); // Only reset when room changes

  // SCROLL TO BOTTOM TRIGGER

  useEffect(() => {
    if (scrollTrigger > 0) {
      const needsJumpToPresent = hasMoreRecent || pendingNewerMessages > 0;

      if (needsJumpToPresent) {
        // Treat "scroll to bottom" as "go to most recent" when the user is in
        // historic mode (present is not mounted).
        didInitialScrollToBottomRef.current = false;
        pendingScrollToBottomReasonRef.current = "scrollTrigger:goToRecent";

        void chatWindow.goToPresent(120);
        setPendingNewerMessages(0);
        pinnedRef.current = true;
        scrollManager.setPinned(true);
      } else {
        scrollManager.scrollToBottom();
        markProgrammaticScroll();
        pinnedRef.current = true;
        scrollManager.setPinned(true);
      }
    }
    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTrigger, markProgrammaticScroll]); // Only trigger on scrollTrigger change

  // SCROLL HANDLER

  const latestScrollStateRef = useRef<{
    scrollManager: typeof scrollManager;
    hasMoreRecent: boolean;
  } | null>(null);

  latestScrollStateRef.current = {
    scrollManager,
    hasMoreRecent,
  };

  const handleScroll = useCallback((event?: Event) => {
    const current = latestScrollStateRef.current;
    if (!current) return;

    const { scrollManager, hasMoreRecent } = current;

    const pos = scrollManager.getScrollPosition();
    if (!pos) {
      return;
    }

    const { distanceFromBottom } = pos;
    // PINNED STATE
    // Pinned-to-bottom is a combination of scroll position AND
    // "present is mounted". If you have evicted newer content (or
    // have a bottom loader), we're not pinned even if you scroll to the
    // absolute bottom.
    const nextPinned =
      !hasMoreRecent && distanceFromBottom <= PINNED_TO_BOTTOM_PX;
    if (nextPinned !== pinnedRef.current) {
      pinnedRef.current = nextPinned;
      scrollManager.setPinned(nextPinned);
      if (nextPinned) setPendingNewerMessages(0);
    }

    // Keep a normalized dimension snapshot updated for the room.
    scrollManager.updateStoreDimensionsDebounced();

    // Pagination triggers live inside the scroll manager.
    scrollManager.handleScroll(event);
  }, []);

  // ATTACH SCROLL LISTENER

  // ATTACH SCROLL LISTENER

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const onScroll = (event: Event) => {
      if (ignoredScrollEventsRef.current > 0) {
        ignoredScrollEventsRef.current -= 1;
        return;
      }
      handleScroll(event);
    };
    container.addEventListener("scroll", onScroll, { passive: true });

    const onWheel = (event: WheelEvent) => {
      if (wheelRafRef.current != null) return;
      wheelRafRef.current = requestAnimationFrame(() => {
        wheelRafRef.current = null;
        handleScroll(event);
      });
    };
    container.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      container.removeEventListener("wheel", onWheel);
      if (wheelRafRef.current != null)
        cancelAnimationFrame(wheelRafRef.current);
      wheelRafRef.current = null;
    };
  }, [chatWindow.status, handleScroll, windowKey]);

  // GO TO RECENT

  const handleGoToRecent = useCallback(() => {
    // Re-arm bottoming logic: this flow can temporarily unmount/remount the scroll container,
    // so an immediate scrollToBottom() can be a no-op.
    didInitialScrollToBottomRef.current = false;
    pendingScrollToBottomReasonRef.current = "goToRecent";
    void chatWindow.goToPresent(120);
    setPendingNewerMessages(0);
    pinnedRef.current = true;
    scrollManager.setPinned(true);
  }, [chatWindow, scrollManager]);

  // MESSAGE RENDERING HELPERS

  const isChannel = type === "channel";
  const { channel: welcomeChannel } = useChannelData(
    board?.id || "",
    isChannel ? paramValue : "",
  );
  const resolvedWelcomeName =
    isChannel && welcomeChannel ? welcomeChannel.name : name;

  const renderMessage = useCallback(
    (
      msg: ChatMessage,
      index: number,
      messages: ChatMessage[],
      options?: {
        groupedTextBubble?: boolean;
        hideAvatarColumn?: boolean;
        showGroupedHeader?: boolean;
        externalHoverArea?: boolean;
        forcedHovered?: boolean;
        messageCompactData?: "0" | "1";
        compactRevisionData?: number;
      },
    ) => {
      const isOptimistic = Boolean("isOptimistic" in msg && msg.isOptimistic);
      const isFailed = Boolean("isFailed" in msg && msg.isFailed);
      const tempId = "tempId" in msg ? (msg.tempId as string) : undefined;

      if ("type" in msg && msg.type === "WELCOME") {
        if (!board) return null;
        const welcomeUsername = getMessageAuthor(msg, {
          fallbackLabel: t.chat.deletedMember,
        })?.username;
        return (
          <WelcomeMessageCard
            boardName={board.name}
            username={welcomeUsername}
          />
        );
      }

      const author = getMessageAuthor(msg, {
        fallbackLabel: t.chat.deletedMember,
      });
      const channelMessage = isChannel ? (msg as ChannelMessage) : null;
      const replyTo = msg.replyTo
        ? {
            ...msg.replyTo,
            sender: getReplyAuthor(msg.replyTo, {
              fallbackLabel: t.chat.deletedMember,
            }),
            fileUrl: msg.replyTo.attachmentAsset?.url || null,
            fileName: msg.replyTo.attachmentAsset?.originalName || null,
          }
        : null;

      const stableCompact = chatWindow.compactById[msg.id] ?? false;
      const textBubbleGroupPosition = getTextBubbleGroupPosition(
        messages,
        index,
        chatWindow.compactById,
      );
      const isLast = index === messages.length - 1;

      return (
        <ChatItemOptimized
          id={msg.id}
          isChannel={isChannel}
          currentProfile={currentProfile}
          currentMember={isChannel ? (currentMember ?? null) : null}
          member={channelMessage?.member}
          messageSenderId={channelMessage?.messageSenderId ?? null}
          author={author!}
          content={msg.content}
          attachmentAsset={msg.attachmentAsset}
          filePreviewUrl={"filePreviewUrl" in msg ? msg.filePreviewUrl : null}
          fileStaticPreviewUrl={
            "fileStaticPreviewUrl" in msg ? msg.fileStaticPreviewUrl : null
          }
          sticker={msg.sticker}
          reactions={msg.reactions}
          deleted={msg.deleted}
          timestamp={formatMessageTimestamp(new Date(msg.createdAt))}
          isUpdated={msg.updatedAt !== msg.createdAt}
          isOptimistic={isOptimistic}
          isFailed={isFailed}
          tempId={tempId}
          apiUrl={apiUrl}
          socketQuery={socketQuery}
          replyTo={replyTo}
          pinned={msg.pinned || false}
          isCompact={stableCompact}
          isLastMessage={isLast}
          textBubbleGroupPosition={textBubbleGroupPosition}
          groupedTextBubble={options?.groupedTextBubble}
          hideAvatarColumn={options?.hideAvatarColumn}
          showGroupedHeader={options?.showGroupedHeader}
          externalHoverArea={options?.externalHoverArea}
          forcedHovered={options?.forcedHovered}
          messageCompactData={options?.messageCompactData}
          compactRevisionData={options?.compactRevisionData}
        />
      );
    },
    [
      board,
      currentProfile,
      currentMember,
      isChannel,
      apiUrl,
      socketQuery,
      chatWindow.compactById,
      t.chat.deletedMember,
    ],
  );

  const messageNodes = useMemo(() => {
    const renderNodes = buildMessageRenderNodes(
      messages,
      chatWindow.compactById,
    );

    return renderNodes.map((node) => {
      if (node.kind === "single") {
        const msg = node.message;
        return (
          <div
            key={msg.id}
            data-message-id={msg.id}
            data-message-compact={chatWindow.compactById[msg.id] ? "1" : "0"}
            data-compact-revision={chatWindow.compactRevision}
          >
            {renderMessage(msg, node.index, messages)}
          </div>
        );
      }

      return (
        <GroupedTextBubbleRun
          key={`text-group-${node.items[0]?.message.id}`}
          items={node.items}
          messages={messages}
          compactById={chatWindow.compactById}
          compactRevision={chatWindow.compactRevision}
          deletedMemberLabel={t.chat.deletedMember}
          fileLabel={t.chat.file}
          stickerLabel={t.chat.sticker}
          editedLabel={t.chat.messageEdited}
          renderMessage={renderMessage}
        />
      );
    });
  }, [
    chatWindow.compactById,
    chatWindow.compactRevision,
    messages,
    renderMessage,
    t.chat.deletedMember,
    t.chat.file,
    t.chat.messageEdited,
    t.chat.sticker,
  ]);

  // LOADING STATE

  if (chatWindow.status === "idle") {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <ChatSkeleton visible={true} heightPx={240} />
      </div>
    );
  }

  if (chatWindow.status === "error") {
    return (
      <div className="flex flex-col flex-1 justify-center items-center">
        <ServerCrash className="h-7 w-7 text-theme-text-tertiary my-4" />
        <p className="text-xs text-theme-text-tertiary">
          Something went wrong!
        </p>
      </div>
    );
  }

  // RENDER

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      {/* Go to Recent Button */}
      <GoToRecentButton
        visible={hasMoreRecent || pendingNewerMessages > 0}
        pendingMessages={pendingNewerMessages}
        onClick={handleGoToRecent}
      />

      {/* Scrollable Container */}
      <div
        ref={scrollContainerCallbackRef}
        className="flex-1 min-h-0 overflow-y-auto scrollbar-chat flex flex-col"
        style={{ overflowAnchor: "none" }}
      >
        <div
          ref={scrollContentCallbackRef}
          className="flex flex-col"
          style={{ overflowAnchor: "none" }}
        >
          {/* Top Skeleton (older / paginate up) */}
          <ChatSkeleton
            origin="top"
            visible={showTopSkeleton}
            heightPx={placeholderHeightPx}
          />

          {/* Welcome (only at oldest) */}
          {showWelcome && (
            <div className="pt-4 pb-4">
              <ChatWelcome
                type={type}
                name={resolvedWelcomeName}
                boardId={socketQuery.boardId}
                channelId={type === "channel" ? paramValue : undefined}
              />
            </div>
          )}

          {/* Messages */}
          {messageNodes}

          {/* Bottom Skeleton (newer / paginate down) */}
          <ChatSkeleton
            origin="bottom"
            visible={showBottomSkeleton}
            heightPx={placeholderHeightPx}
          />
        </div>
      </div>
    </div>
  );
}

export const ChatMessages = memo(ChatMessagesComponent);
