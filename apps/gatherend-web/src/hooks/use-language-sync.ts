"use client";

import { useEffect, useRef } from "react";
import { detectBoardLanguages } from "@/lib/detect-language";
import { fetchWithRetry } from "@/lib/fetch-with-retry";
import { useSession } from "@/lib/better-auth-client";

export function useLanguageSync() {
  const { data: session, isPending } = useSession();
  const syncedRef = useRef(false);

  const isLoaded = !isPending;
  const isSignedIn = Boolean(session?.user?.id);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (syncedRef.current) return;

    const syncLanguages = async () => {
      try {
        const browserLangs = detectBoardLanguages();

        const response = await fetchWithRetry("/api/profile/sync-languages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ languages: browserLangs }),
        });

        if (response.ok) {
          syncedRef.current = true;
        }
      } catch (error) {
        console.error("[useLanguageSync] Failed to sync languages:", error);
      }
    };

    syncLanguages();
  }, [isLoaded, isSignedIn]);
}
