"use client";

import { useEffect, useRef } from "react";
import {
  useBoardSwitchNavigation,
  useBoardSwitchRouting,
} from "@/contexts/board-switch-context";

interface UseChannelRedirectionResult {
  isRedirecting: boolean;
}

/**
 * Legacy fallback hook used by /boards/[boardId].
 * The route now resolves to the last board view, defaulting to Rules.
 */
export function useChannelRedirection(): UseChannelRedirectionResult {
  const {
    currentBoardId,
    currentChannelId,
    currentConversationId,
    isDiscovery,
    isChannels,
    isForum,
    isRules,
  } = useBoardSwitchRouting();
  const { switchBoard, isClientNavigationEnabled } =
    useBoardSwitchNavigation();
  const redirectAttemptedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isClientNavigationEnabled) return;
    if (
      currentChannelId ||
      currentConversationId ||
      isDiscovery ||
      isChannels ||
      isForum ||
      isRules
    ) {
      return;
    }
    if (redirectAttemptedRef.current === currentBoardId) return;

    redirectAttemptedRef.current = currentBoardId;
    switchBoard(currentBoardId, undefined, { history: "replace" });
  }, [
    currentBoardId,
    currentChannelId,
    currentConversationId,
    isDiscovery,
    isChannels,
    isForum,
    isRules,
    isClientNavigationEnabled,
    switchBoard,
  ]);

  return {
    isRedirecting:
      !currentChannelId &&
      !currentConversationId &&
      !isDiscovery &&
      !isChannels &&
      !isForum &&
      !isRules,
  };
}
