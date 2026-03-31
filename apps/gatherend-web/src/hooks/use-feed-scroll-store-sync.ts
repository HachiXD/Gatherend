"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { feedScrollStore } from "@/stores/feed-scroll-store";
import {
  COMMUNITIES_FEED_KEY,
  COMMUNITIES_FEED_SCROLL_KEY,
} from "@/hooks/discovery/community-feed/use-communities-feed";

export function useFeedScrollStoreSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const queryCache = queryClient.getQueryCache();

    const unsubscribe = queryCache.subscribe((event) => {
      if (event.type !== "removed") return;

      const queryKey = event.query.queryKey;

      if (
        queryKey.length === COMMUNITIES_FEED_KEY.length &&
        queryKey[0] === COMMUNITIES_FEED_KEY[0]
      ) {
        feedScrollStore.clear(COMMUNITIES_FEED_SCROLL_KEY);
        return;
      }
    });

    return unsubscribe;
  }, [queryClient]);
}
