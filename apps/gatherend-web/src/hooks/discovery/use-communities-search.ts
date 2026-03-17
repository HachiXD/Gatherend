"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

const DEBOUNCE_MS = 350;

// --- TIPOS ---
export interface CommunitySearchResult {
  id: string;
  name: string;
  imageAsset: ClientUploadedAsset | null;
  memberCount: number;
  boardCount: number;
  recentPostCount7d: number;
}

interface UseCommunitiesSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  results: CommunitySearchResult[];
  isLoading: boolean;
  error: string | null;
  hasNextPage: boolean;
  loadMore: () => void;
  clear: () => void;
}

/**
 * Hook para búsqueda de communities con debounce y paginación.
 * Usa ILIKE en el backend para búsqueda parcial por nombre.
 */
export function useCommunitiesSearch(): UseCommunitiesSearchReturn {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CommunitySearchResult[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Controlador para cancelar requests previos
  const abortRef = useRef<AbortController | null>(null);

  // Debounce timer
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Función de fetch
  const fetchSearch = useCallback(
    async (
      searchQuery: string,
      currentCursor: string | null,
      append: boolean,
    ) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setHasNextPage(false);
        setCursor(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      // Cancelar request anterior
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const params = new URLSearchParams({ q: searchQuery });
        if (currentCursor) {
          params.set("cursor", currentCursor);
        }

        const res = await fetch(
          `/api/discovery/communities/search?${params.toString()}`,
          { signal: controller.signal },
        );

        if (!res.ok) {
          throw new Error(`Search error: ${res.status}`);
        }

        const data = await res.json();

        if (append) {
          // Paginación: agregar a resultados existentes
          setResults((prev) => [...prev, ...data.items]);
        } else {
          // Nueva búsqueda: reemplazar resultados
          setResults(data.items);
        }

        setHasNextPage(data.hasMore);
        setCursor(data.nextCursor);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          // Request cancelado, ignorar
          return;
        }
        console.error("[COMMUNITIES_SEARCH]", err);
        setError(err instanceof Error ? err.message : "Error de búsqueda");
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Efecto para búsqueda con debounce cuando cambia query
  useEffect(() => {
    // Limpiar debounce previo
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Si no hay query, limpiar resultados
    if (!query.trim()) {
      setResults([]);
      setHasNextPage(false);
      setCursor(null);
      return;
    }

    // Debounce la búsqueda
    debounceRef.current = setTimeout(() => {
      fetchSearch(query, null, false);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, fetchSearch]);

  // Cargar más resultados
  const loadMore = useCallback(() => {
    if (!hasNextPage || isLoading || !cursor) return;
    fetchSearch(query, cursor, true);
  }, [hasNextPage, isLoading, cursor, query, fetchSearch]);

  // Limpiar búsqueda
  const clear = useCallback(() => {
    setQuery("");
    setResults([]);
    setCursor(null);
    setHasNextPage(false);
    setError(null);
  }, []);

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    hasNextPage,
    loadMore,
    clear,
  };
}
