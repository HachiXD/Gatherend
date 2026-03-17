"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { chatScrollDimensionsStore } from "@/hooks/chat/chat-scroll-dimensions-store";

function getChatWindowKey(roomType: "channel" | "conversation", roomId: string) {
  return `chatWindow:${roomType}:${roomId}`;
}

export function useChatScrollDimensionsSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const queryCache = queryClient.getQueryCache();

    const unsubscribe = queryCache.subscribe((event) => {
      if (event.type !== "removed") return;

      const queryKey = event.query.queryKey;
      if (queryKey[0] !== "chat") return;
      if (
        queryKey[1] !== "channel" &&
        queryKey[1] !== "conversation"
      ) {
        return;
      }
      if (typeof queryKey[2] !== "string") return;

      chatScrollDimensionsStore.clear(
        getChatWindowKey(queryKey[1], queryKey[2]),
      );
    });

    return unsubscribe;
  }, [queryClient]);
}
