import type { QueryClient } from "@tanstack/react-query";
import type { Conversation } from "@/src/features/conversations/domain/conversation";
import {
  CONVERSATIONS_QUERY_KEY,
} from "@/src/features/conversations/queries";
import { chatMessageWindowStore } from "@/src/features/chat/store/chat-message-window-store";

export type ProfilePatch = Record<string, unknown>;

export function applyPatch<T extends object>(obj: T, patch: ProfilePatch): T {
  const next: Record<string, unknown> = { ...(obj as Record<string, unknown>) };
  let changed = false;

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (Object.is(next[key], value)) continue;
    next[key] = value;
    changed = true;
  }

  return changed ? (next as T) : obj;
}

function patchConversationProfiles(
  conversation: Conversation,
  profileId: string,
  patch: ProfilePatch,
): Conversation {
  const shouldPatchOne = conversation.profileOne?.id === profileId;
  const shouldPatchTwo = conversation.profileTwo?.id === profileId;
  const shouldPatchOther = conversation.otherProfile?.id === profileId;

  if (!shouldPatchOne && !shouldPatchTwo && !shouldPatchOther) {
    return conversation;
  }

  return {
    ...conversation,
    profileOne: shouldPatchOne
      ? applyPatch(conversation.profileOne, patch)
      : conversation.profileOne,
    profileTwo: shouldPatchTwo
      ? applyPatch(conversation.profileTwo, patch)
      : conversation.profileTwo,
    otherProfile: shouldPatchOther
      ? applyPatch(conversation.otherProfile, patch)
      : conversation.otherProfile,
  };
}

export function applyProfilePatchToAllMobileCaches(
  queryClient: QueryClient,
  profileId: string,
  patch: ProfilePatch,
) {
  // current-profile query
  queryClient.setQueryData<Record<string, unknown>>(
    ["current-profile"],
    (old) => {
      if (!old) return old;
      return applyPatch(old, patch);
    },
  );

  // Conversations list
  queryClient.setQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY, (old) => {
    if (!old) return old;
    let changed = false;
    const next = old.map((c) => {
      const patched = patchConversationProfiles(c, profileId, patch);
      if (patched !== c) changed = true;
      return patched;
    });
    return changed ? next : old;
  });

  // Individual conversation caches
  const conversationQueries = queryClient
    .getQueryCache()
    .findAll({ queryKey: ["conversation"] });
  for (const q of conversationQueries) {
    queryClient.setQueryData<Conversation>(q.queryKey, (old) => {
      if (!old) return old;
      return patchConversationProfiles(old, profileId, patch);
    });
  }

  // Chat message windows
  chatMessageWindowStore.patchProfile(profileId, patch);
}
