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
} from "react";

import { ChatWelcome } from "./chat-welcome";
import { ChatItemOptimized } from "./chat-item-optimized";
import { WelcomeMessageCard } from "./welcome-message-card";
import { ChatSkeleton } from "./chat-skeleton";
import { GoToRecentButton } from "./go-to-recent-button";

import {
  useChatMessageWindow,
  useScrollManager,
  ChatMessage,
  ChatMessagesProps,
  generateChatPlaceholderSpecs,
} from "@/hooks/chat";

import { chatScrollDimensionsStore } from "@/hooks/chat/chat-scroll-dimensions-store";

import { useChatSocket } from "@/hooks/use-chat-socket";
import { useUnreadStore } from "@/hooks/use-unread-store";
import { useMentionStore } from "@/hooks/use-mention-store";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useTokenGetter } from "@/components/providers/token-manager-provider";
import { getExpressAuthHeaders } from "@/lib/express-fetch";

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

  // KEYS

  const queryKey = useMemo(
    () => ["chat", type, paramValue],
    [type, paramValue],
  );
  const addKey = `chat:${paramValue}:messages`;
  const updateKey = `chat:${paramValue}:messages:update`;

  // STORES

  const clearUnread = useUnreadStore((state) => state.clearUnread);
  const setViewingRoom = useUnreadStore((state) => state.setViewingRoom);
  const setLastAck = useUnreadStore((state) => state.setLastAck);
  const clearMention = useMentionStore((state) => state.clearMention);
  const scrollTrigger = useScrollToBottom((state) => state.scrollTrigger);

  // VIEWPORT STATE

  const pinnedRef = useRef(true);
  const [pendingNewerMessages, setPendingNewerMessages] = useState(0);
  const windowKey = useMemo(
    () => `chatWindow:${type}:${paramValue}`,
    [paramValue, type],
  );

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

  // AUTH

  const getToken = useTokenGetter();

  const prevCauseRef = useRef<{
    getToken: unknown;
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
    getToken,
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

  if (!prevCause || prevCause.getToken !== currentCause.getToken)
    changedCause.push("getTokenRef");
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

  // SOCKET

  useChatSocket({
    queryKey,
    addKey,
    updateKey,
    roomId: paramValue,
    roomType: type,
    currentProfileId: currentProfile.id,
    currentRoomId: paramValue,
    isInHistoricalMode: hasMoreRecent,
    onNewMessageWhileHistorical: () => {
      setPendingNewerMessages((c) => c + 1);
    },
  });

  // MARK AS READ ON MOUNT

  useEffect(() => {
    setViewingRoom(paramValue);
    clearUnread(paramValue);
    clearMention(paramValue);
    setLastAck(paramValue);

    const markAsRead = async () => {
      const socketUrl =
        process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
      const endpoint =
        type === "conversation"
          ? `${socketUrl}/conversation-read-state/${paramValue}/read`
          : `${socketUrl}/channel-read-state/${paramValue}/read`;

      const token = await getToken();
      await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: getExpressAuthHeaders(currentProfile.id, token),
      }).catch(() => {});
    };

    markAsRead();
    return () => {
      setViewingRoom(null);
    };
  }, [
    paramValue,
    type,
    currentProfile.id,
    clearUnread,
    clearMention,
    setViewingRoom,
    setLastAck,
    getToken,
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

  const renderMessage = useCallback(
    (msg: ChatMessage, index: number, messages: ChatMessage[]) => {
      const getSenderId = (m: ChatMessage | undefined): string | null => {
        if (!m) return null;
        const withMember = "member" in m;
        const senderProfile = withMember ? m.member?.profile : m.sender;
        return senderProfile?.id ?? null;
      };

      const isWelcome = (m: ChatMessage | undefined): boolean => {
        return Boolean(m && "type" in m && m.type === "WELCOME");
      };

      const isMessageWithMember = "member" in msg;
      const isOptimistic = Boolean("isOptimistic" in msg && msg.isOptimistic);
      const isFailed = Boolean("isFailed" in msg && msg.isFailed);
      const tempId = "tempId" in msg ? (msg.tempId as string) : undefined;

      if ("type" in msg && msg.type === "WELCOME") {
        if (!board) return null;
        const welcomeUsername =
          "member" in msg ? msg.member?.profile?.username : undefined;
        return <WelcomeMessageCard board={board} username={welcomeUsername} />;
      }

      const sender = isMessageWithMember ? msg.member?.profile : msg.sender;
      if (!sender) return null;
      const replyTo = msg.replyTo
        ? {
            ...msg.replyTo,
            sender:
              msg.replyTo.sender || msg.replyTo.member?.profile || sender,
            fileUrl: msg.replyTo.attachmentAsset?.url || null,
            fileName: msg.replyTo.attachmentAsset?.originalName || null,
          }
        : null;

      const stableCompact = chatWindow.compactById[msg.id] ?? false;
      const prevMessage = index > 0 ? messages[index - 1] : undefined;
      const currentSenderId = getSenderId(msg);
      const prevSenderId = getSenderId(prevMessage);
      const sameSender =
        currentSenderId != null &&
        prevSenderId != null &&
        currentSenderId === prevSenderId;
      const currentTimeMs = new Date(msg.createdAt).getTime();
      const prevTimeMs = prevMessage
        ? new Date(prevMessage.createdAt).getTime()
        : Number.NaN;
      const diffMs =
        Number.isFinite(currentTimeMs) && Number.isFinite(prevTimeMs)
          ? Math.abs(currentTimeMs - prevTimeMs)
          : null;

      const isLast = index === messages.length - 1;

      return (
        <ChatItemOptimized
          id={msg.id}
          currentProfile={currentProfile}
          currentMember={isChannel ? (currentMember ?? null) : null}
          member={isMessageWithMember ? msg.member : undefined}
          sender={sender}
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
      chatWindow.compactRevision,
    ],
  );

  const messageNodes = useMemo(() => {
    return messages.map((msg, index) => (
      <div
        key={msg.id}
        data-message-id={msg.id}
        data-message-compact={chatWindow.compactById[msg.id] ? "1" : "0"}
        data-compact-revision={chatWindow.compactRevision}
      >
        {renderMessage(msg, index, messages)}
      </div>
    ));
  }, [
    chatWindow.compactById,
    chatWindow.compactRevision,
    messages,
    renderMessage,
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
                name={name}
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
