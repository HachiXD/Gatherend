"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { feedScrollStore } from "@/stores/feed-scroll-store";
import {
  COMMUNITIES_FEED_KEY,
  COMMUNITIES_FEED_SCROLL_KEY,
} from "@/hooks/discovery/community-feed/use-communities-feed";
import {
  communityBoardsScrollKey,
} from "@/hooks/discovery/boards-feed/use-community-boards-feed";
import {
  communityPostsScrollKey,
} from "@/hooks/discovery/posts-feed/use-community-posts-feed";

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

      if (
        queryKey.length === 2 &&
        queryKey[0] === "community-boards-feed" &&
        typeof queryKey[1] === "string"
      ) {
        feedScrollStore.clear(communityBoardsScrollKey(queryKey[1]));
        return;
      }

      if (
        queryKey.length === 2 &&
        queryKey[0] === "community-posts-feed" &&
        typeof queryKey[1] === "string"
      ) {
        feedScrollStore.clear(communityPostsScrollKey(queryKey[1]));
      }
    });

    return unsubscribe;
  }, [queryClient]);
}
