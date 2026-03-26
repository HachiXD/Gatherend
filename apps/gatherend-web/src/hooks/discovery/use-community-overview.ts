"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import {
  COMMUNITIES_FEED_KEY,
  type CommunityFeedPage,
  mergeCommunityToFeedCache,
} from "./community-feed/use-communities-feed";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

export interface CommunityOverview {
  id: string;
  name: string;
  imageAsset: ClientUploadedAsset | null;
  memberCount: number;
  activeBoardsCount: number;
  recentPostCount7d: number;
  canDeleteAnyPost: boolean;
  isMember: boolean;
}

export const communityOverviewKey = (communityId: string) =>
  ["community-overview", communityId] as const;

async function fetchCommunityOverview(
  communityId: string,
): Promise<CommunityOverview> {
  const url = new URL(
    `/api/discovery/communities/${communityId}`,
    window.location.origin,
  );

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Error al cargar la comunidad");

  return res.json();
}

async function fetchCommunityPermissions(
  communityId: string,
): Promise<{ canManageCommunityContent: boolean; isMember: boolean }> {
  const url = new URL(
    `/api/discovery/communities/${communityId}/permissions`,
    window.location.origin,
  );

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Error al cargar permisos de la comunidad");

  return res.json();
}

interface UseCommunityOverviewOptions {
  enabled?: boolean;
}

export function useCommunityOverview(
  communityId: string,
  { enabled = true }: UseCommunityOverviewOptions = {},
) {
  const queryClient = useQueryClient();

  const cachedFeedCommunity = useMemo(() => {
    if (!communityId) return null;

    const feedData = queryClient.getQueryData<{
      pages: CommunityFeedPage[];
      pageParams: unknown[];
    }>(COMMUNITIES_FEED_KEY);

    if (!feedData) return null;

    for (const page of feedData.pages) {
      const community = page.items.find((item) => item.id === communityId);
      if (community) {
        return community;
      }
    }

    return null;
  }, [communityId, queryClient]);

  const query = useQuery({
    queryKey: communityOverviewKey(communityId),
    queryFn: async () => {
      if (cachedFeedCommunity) {
        const permissions = await fetchCommunityPermissions(communityId);

        return {
          id: cachedFeedCommunity.id,
          name: cachedFeedCommunity.name,
          imageAsset: cachedFeedCommunity.imageAsset,
          memberCount: cachedFeedCommunity.memberCount,
          activeBoardsCount: cachedFeedCommunity.boardCount,
          recentPostCount7d: cachedFeedCommunity.recentPostCount7d,
          canDeleteAnyPost: permissions.canManageCommunityContent,
          isMember: permissions.isMember,
        };
      }

      return fetchCommunityOverview(communityId);
    },
    placeholderData: cachedFeedCommunity
      ? {
          id: cachedFeedCommunity.id,
          name: cachedFeedCommunity.name,
          imageAsset: cachedFeedCommunity.imageAsset,
          memberCount: cachedFeedCommunity.memberCount,
          activeBoardsCount: cachedFeedCommunity.boardCount,
          recentPostCount7d: cachedFeedCommunity.recentPostCount7d,
          canDeleteAnyPost: false,          isMember: false,        }
      : undefined,
    staleTime: 1000 * 60,
    enabled: enabled && !!communityId,
  });

  useEffect(() => {
    if (!query.data) return;

    mergeCommunityToFeedCache(queryClient, {
      id: query.data.id,
      memberCount: query.data.memberCount,
      boardCount: query.data.activeBoardsCount,
    });
  }, [query.data, queryClient]);

  return {
    community: query.data ?? null,
    isLoading: query.isLoading,
    isFetchingMembership: query.isLoading || query.isPlaceholderData,
    error: query.error?.message ?? null,
    refresh: query.refetch,
  };
}
