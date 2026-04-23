"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSocketClient,
  useSocketRecoveryVersion,
} from "@/components/providers/socket-context";
import {
  applyProfilePatchToAllCaches,
  type ProfilePatch,
} from "./profile-patch-utils";
import { getTrackedProfileIds } from "@/lib/profile-watch-registry";
import axios from "axios";

type ProfileUpdatedPayload = {
  profileId?: unknown;
  patch?: unknown;
};

// Sync profiles from server after reconnection
async function syncProfilesOnReconnect(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  const ids = getTrackedProfileIds();
  if (ids.length === 0) return;

  try {
    const { data: profiles } = await axios.post("/api/profiles/batch", { ids });
    if (!Array.isArray(profiles)) return;

    for (const profile of profiles) {
      if (typeof profile?.id !== "string") continue;
      applyProfilePatchToAllCaches(queryClient, profile.id, profile);
    }
  } catch {
    // This catch is not critical, stale profiles will update on next socket event
  }
}

export function useProfileUpdatesSocket() {
  const { socket } = useSocketClient();
  const reconnectVersion = useSocketRecoveryVersion();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    const handleProfileUpdated = (payload: ProfileUpdatedPayload) => {
      const profileId = payload?.profileId;
      const patch = payload?.patch as ProfilePatch | undefined;
      if (typeof profileId !== "string" || !profileId) return;
      if (!patch || typeof patch !== "object") return;

      applyProfilePatchToAllCaches(queryClient, profileId, patch);
    };

    socket.on("profile:updated", handleProfileUpdated);

    return () => {
      socket.off("profile:updated", handleProfileUpdated);
    };
  }, [socket, queryClient]);

  useEffect(() => {
    if (reconnectVersion === 0) return;
    void syncProfilesOnReconnect(queryClient);
  }, [queryClient, reconnectVersion]);
}
