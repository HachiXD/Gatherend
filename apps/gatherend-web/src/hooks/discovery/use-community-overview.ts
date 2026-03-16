"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { mergeCommunityToFeedCache } from "./community-feed/use-communities-feed";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

export interface CommunityOverview {
  id: string;
  name: string;
  imageAsset: ClientUploadedAsset | null;
  memberCount: number;
  activeBoardsCount: number;
  postCount: number;
  canDeleteAnyPost: boolean;
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

interface UseCommunityOverviewOptions {
  enabled?: boolean;
}

export function useCommunityOverview(
  communityId: string,
  { enabled = true }: UseCommunityOverviewOptions = {},
) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: communityOverviewKey(communityId),
    queryFn: () => fetchCommunityOverview(communityId),
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
    error: query.error?.message ?? null,
    refresh: query.refetch,
  };
}
