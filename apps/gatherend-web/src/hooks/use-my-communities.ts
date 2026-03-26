"use client";

import { useQuery } from "@tanstack/react-query";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

export interface MyCommunity {
  id: string;
  name: string;
  imageAsset: ClientUploadedAsset | null;
}

async function fetchMyCommunities(): Promise<MyCommunity[]> {
  const res = await fetch("/api/my-communities", {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch my communities: ${res.status}`);
  }

  return res.json();
}

export function useMyCommunities() {
  const {
    data: communities = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["my-communities"],
    queryFn: fetchMyCommunities,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  return {
    communities,
    isLoading,
    error: error?.message || null,
    refetch,
  };
}
