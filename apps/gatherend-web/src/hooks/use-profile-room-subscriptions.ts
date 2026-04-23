"use client";

import { useEffect, useMemo, useRef } from "react";
import { useSocketClient } from "@/components/providers/socket-context";
import {
  ensureProfileWatchSocketBound,
  subscribeToProfileWatches,
  unsubscribeFromProfileWatches,
} from "@/lib/profile-watch-registry";

const MAX_PROFILE_IDS_PER_HOOK = 100;

function normalizeProfileIds(profileIds: string[]): string[] {
  const unique = new Set<string>();
  for (const id of profileIds) {
    if (typeof id !== "string") continue;
    const trimmed = id.trim();
    if (!trimmed) continue;
    unique.add(trimmed);
    if (unique.size >= MAX_PROFILE_IDS_PER_HOOK) break;
  }
  return [...unique];
}

type SubscriptionSnapshot = {
  ids: string[];
  set: Set<string>;
};

/**
 * Subscribe this client to profile watch rooms (deduped + ref-counted globally).
 *
 * Server-side rooms are `profile-watch:${profileId}` (not `profile:${profileId}`).
 */
export function useProfileRoomSubscriptions(profileIds: string[]) {
  const { socket } = useSocketClient();

  const snapshot: SubscriptionSnapshot = useMemo(() => {
    const ids = normalizeProfileIds(profileIds);
    return { ids, set: new Set(ids) };
  }, [profileIds]);

  const prevRef = useRef<SubscriptionSnapshot>({ ids: [], set: new Set() });

  useEffect(() => {
    if (!socket) return;

    ensureProfileWatchSocketBound(socket);

    const prev = prevRef.current;
    const next = snapshot;

    const toAdd: string[] = [];
    for (const id of next.ids) {
      if (!prev.set.has(id)) toAdd.push(id);
    }

    const toRemove: string[] = [];
    for (const id of prev.ids) {
      if (!next.set.has(id)) toRemove.push(id);
    }

    if (toAdd.length > 0) subscribeToProfileWatches(socket, toAdd);
    if (toRemove.length > 0) unsubscribeFromProfileWatches(socket, toRemove);

    prevRef.current = next;
    // Intentionally exclude `snapshot` object identity from deps (derived from `profileIds`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, snapshot.ids.join("|")]);

  useEffect(() => {
    if (!socket) return;

    return () => {
      const prev = prevRef.current;
      if (prev.ids.length > 0) {
        unsubscribeFromProfileWatches(socket, prev.ids);
      }
      prevRef.current = { ids: [], set: new Set() };
    };
  }, [socket]);
}
