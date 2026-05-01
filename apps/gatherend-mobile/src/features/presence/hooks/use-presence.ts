import { useCallback, useEffect, useMemo, useRef } from "react";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { usePresenceStore } from "@/src/features/presence/store/use-presence-store";
import { expressFetch } from "@/src/services/express/express-fetch";
import { useSocket } from "@/src/providers/socket-context";

type PresenceEvent = {
  profileId: string;
  timestamp: string;
};

export function usePresence(profileIds: string[]) {
  const profile = useProfile();
  const { socket } = useSocket();

  const setUserOnline = usePresenceStore(
    useCallback((state) => state.setUserOnline, []),
  );
  const setUserOffline = usePresenceStore(
    useCallback((state) => state.setUserOffline, []),
  );
  const mergePresence = usePresenceStore(
    useCallback((state) => state.mergePresence, []),
  );
  const isOnline = usePresenceStore(useCallback((state) => state.isOnline, []));

  const normalizedProfileIds = useMemo(
    () => Array.from(new Set(profileIds.filter(Boolean))).sort(),
    [profileIds],
  );
  const profileIdsKey = useMemo(
    () => normalizedProfileIds.join(","),
    [normalizedProfileIds],
  );
  const hasFetchedRef = useRef(false);
  const lastFetchKeyRef = useRef("");

  const fetchPresence = useCallback(async () => {
    if (normalizedProfileIds.length === 0) return;

    try {
      const response = await expressFetch("/presence/check", {
        method: "POST",
        profileId: profile.id,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ profileIds: normalizedProfileIds }),
      });

      if (!response.ok) return;

      const data = (await response.json()) as {
        presence?: Record<string, boolean>;
      };
      mergePresence(data.presence ?? {});
    } catch (error) {
      if (__DEV__) {
        console.warn("[Presence] Error fetching presence:", error);
      }
    }
  }, [mergePresence, normalizedProfileIds, profile.id]);

  useEffect(() => {
    if (!socket || normalizedProfileIds.length === 0) return;

    if (!hasFetchedRef.current || lastFetchKeyRef.current !== profileIdsKey) {
      void fetchPresence();
      hasFetchedRef.current = true;
      lastFetchKeyRef.current = profileIdsKey;
    }
  }, [fetchPresence, normalizedProfileIds.length, profileIdsKey, socket]);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      void fetchPresence();
    };

    socket.on("connect", handleConnect);

    return () => {
      socket.off("connect", handleConnect);
    };
  }, [fetchPresence, socket]);

  useEffect(() => {
    if (!socket) return;

    const handleUserOnline = (event: PresenceEvent) => {
      setUserOnline(event.profileId);
    };

    const handleUserOffline = (event: PresenceEvent) => {
      setUserOffline(event.profileId);
    };

    socket.on("presence:user-online", handleUserOnline);
    socket.on("presence:user-offline", handleUserOffline);

    return () => {
      socket.off("presence:user-online", handleUserOnline);
      socket.off("presence:user-offline", handleUserOffline);
    };
  }, [setUserOffline, setUserOnline, socket]);

  return { isOnline, refetch: fetchPresence };
}
