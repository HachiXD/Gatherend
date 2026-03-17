"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { useFeedScrollStoreSync } from "@/hooks/use-feed-scroll-store-sync";
import { useChatScrollDimensionsSync } from "@/hooks/use-chat-scroll-dimensions-sync";
/**
 * QueryProvider optimizado para Gatherend
 *
 * Estrategia de cache:
 * - staleTime: 30s para datos generales (los mensajes se actualizan via sockets)
 * - gcTime: 5 min para mantener cache en memoria
 * - refetchOnWindowFocus: false (tenemos real-time via WebSocket)
 * - refetchOnMount: false (evita queries redundantes al navegar)
 */
export const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Cache optimizado - datos se actualizan via sockets
            staleTime: 1000 * 30, // 30 segundos antes de considerarse stale
            gcTime: 1000 * 60 * 5, // 5 minutos en garbage collection

            // Evitar refetches innecesarios (ya tenemos WebSocket para real-time)
            refetchOnWindowFocus: false,
            refetchOnMount: false,
            refetchOnReconnect: false,

            // Retry conservador para evitar saturar el servidor
            retry: 1,
            retryDelay: (attemptIndex) =>
              Math.min(1000 * 2 ** attemptIndex, 10000),
          },
          mutations: {
            // Retry en mutaciones para mejor UX
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <QueryStoreSync />
      {children}
    </QueryClientProvider>
  );
};

function QueryStoreSync() {
  useFeedScrollStoreSync();
  useChatScrollDimensionsSync();

  return null;
}

