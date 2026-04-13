import type { QueryClient } from "@tanstack/react-query";
import {
  conversationsQueryKey,
  type FormattedConversation,
} from "./use-conversations";
import { chatMessageWindowStore } from "@/hooks/chat/chat-message-window-store";
import { patchBoardMemberProfileInCache } from "@/hooks/board-cache";

export type ProfilePatch = Record<string, unknown>;

export function applyPatch<T extends object>(
  obj: T,
  patch: ProfilePatch,
): T {
  const next: Record<string, unknown> = {
    ...(obj as Record<string, unknown>),
  };
  let changed = false;

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (Object.is(next[key], value)) continue;
    next[key] = value;
    changed = true;
  }

  return changed ? (next as T) : obj;
}

export function patchConversationProfiles(
  conversation: FormattedConversation,
  profileId: string,
  patch: ProfilePatch,
): FormattedConversation {
  const shouldPatchOther = conversation.otherProfile?.id === profileId;
  const shouldPatchOne = conversation.profileOne?.id === profileId;
  const shouldPatchTwo = conversation.profileTwo?.id === profileId;

  if (!shouldPatchOther && !shouldPatchOne && !shouldPatchTwo)
    return conversation;

  return {
    ...conversation,
    otherProfile: shouldPatchOther
      ? applyPatch(conversation.otherProfile, patch)
      : conversation.otherProfile,
    profileOne: shouldPatchOne
      ? applyPatch(conversation.profileOne, patch)
      : conversation.profileOne,
    profileTwo: shouldPatchTwo
      ? applyPatch(conversation.profileTwo, patch)
      : conversation.profileTwo,
  };
}

type ConversationDetailCache = {
  profileOne?: ({ id?: string } & Record<string, unknown>) | null;
  profileTwo?: ({ id?: string } & Record<string, unknown>) | null;
};

// Apply a profile patch to all relevant caches
export function applyProfilePatchToAllCaches(
  queryClient: QueryClient,
  profileId: string,
  patch: ProfilePatch,
) {
  // Conversations list
  queryClient.setQueryData<FormattedConversation[]>(
    conversationsQueryKey,
    (old) => {
      if (!old) return old;
      let changed = false;
      const next = old.map((c) => {
        const patched = patchConversationProfiles(c, profileId, patch);
        if (patched !== c) changed = true;
        return patched;
      });
      return changed ? next : old;
    },
  );

  // Individual conversation caches
  const conversationQueries = queryClient
    .getQueryCache()
    .findAll({ queryKey: ["conversation"] });
  for (const q of conversationQueries) {
    queryClient.setQueryData<ConversationDetailCache>(q.queryKey, (old) => {
      if (!old) return old;
      const oneId = old?.profileOne?.id;
      const twoId = old?.profileTwo?.id;
      if (oneId !== profileId && twoId !== profileId) return old;
      return {
        ...old,
        profileOne:
          oneId === profileId && old.profileOne
            ? applyPatch(old.profileOne, patch)
            : old.profileOne,
        profileTwo:
          twoId === profileId && old.profileTwo
            ? applyPatch(old.profileTwo, patch)
            : old.profileTwo,
      };
    });
  }

  patchBoardMemberProfileInCache(queryClient, profileId, (profile) =>
    applyPatch(profile, patch),
  );

  // Profile card
  queryClient.setQueryData<Record<string, unknown>>(
    ["profile-card", profileId],
    (old) => {
    if (!old) return old;
    return applyPatch(old, patch);
    },
  );

  // Chat windows
  chatMessageWindowStore.patchProfile(profileId, patch);
}
