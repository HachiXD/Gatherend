"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

export interface CommunityOption {
  id: string;
  name: string;
  imageAsset: ClientUploadedAsset | null;
  memberCount: number;
  boardCount: number;
}

async function fetchCommunitiesList(
  search: string
): Promise<CommunityOption[]> {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  params.set("limit", "10");

  const res = await fetch(`/api/communities?${params.toString()}`);

  if (!res.ok) {
    throw new Error(`Failed to fetch communities: ${res.status}`);
  }

  return res.json();
}

// Hook para debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function useCommunitiesList(search: string = "") {
  // Debounce la búsqueda para no hacer requests en cada keystroke
  const debouncedSearch = useDebounce(search.trim(), 300);

  const {
    data: communities = [],
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["communities-list", debouncedSearch],
    queryFn: () => fetchCommunitiesList(debouncedSearch),
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  return {
    communities,
    isLoading,
    isFetching, // Para mostrar loading mientras busca
    error: error?.message || null,
    refetch,
  };
}
