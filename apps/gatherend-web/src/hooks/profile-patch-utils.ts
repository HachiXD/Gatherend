import type { QueryClient } from "@tanstack/react-query";
import {
  conversationsQueryKey,
  type FormattedConversation,
} from "./use-conversations";
import { chatMessageWindowStore } from "@/hooks/chat/chat-message-window-store";
import type { BoardWithData } from "@/components/providers/board-provider";

export type ProfilePatch = Record<string, unknown>;

export function applyPatch<T extends Record<string, any>>(
  obj: T,
  patch: ProfilePatch,
): T {
  const next: Record<string, any> = { ...obj };
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
      ? applyPatch(conversation.otherProfile as any, patch)
      : conversation.otherProfile,
    profileOne: shouldPatchOne
      ? applyPatch(conversation.profileOne as any, patch)
      : conversation.profileOne,
    profileTwo: shouldPatchTwo
      ? applyPatch(conversation.profileTwo as any, patch)
      : conversation.profileTwo,
  };
}

export function patchBoardProfiles(
  board: BoardWithData,
  profileId: string,
  patch: ProfilePatch,
): BoardWithData {
  let changed = false;

  const nextMembers = board.members.map((m) => {
    const pid = m.profile?.id;
    if (pid !== profileId || !m.profile) return m;
    const nextProfile = applyPatch(m.profile as any, patch);
    if (nextProfile === m.profile) return m;
    changed = true;
    return { ...m, profile: nextProfile };
  });

  if (!changed) return board;

  return {
    ...board,
    members: nextMembers,
  };
}

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
    queryClient.setQueryData(q.queryKey, (old: any) => {
      if (!old) return old;
      const oneId = old?.profileOne?.id;
      const twoId = old?.profileTwo?.id;
      if (oneId !== profileId && twoId !== profileId) return old;
      return {
        ...old,
        profileOne:
          oneId === profileId
            ? applyPatch(old.profileOne, patch)
            : old.profileOne,
        profileTwo:
          twoId === profileId
            ? applyPatch(old.profileTwo, patch)
            : old.profileTwo,
      };
    });
  }

  // Boards (multiple cached boards)
  const boardQueries = queryClient
    .getQueryCache()
    .findAll({ queryKey: ["board"] });
  for (const q of boardQueries) {
    queryClient.setQueryData<BoardWithData>(q.queryKey, (old) => {
      if (!old) return old;
      return patchBoardProfiles(old, profileId, patch);
    });
  }

  // Profile card
  queryClient.setQueryData(["profile-card", profileId], (old: any) => {
    if (!old) return old;
    return applyPatch(old, patch);
  });

  // Chat windows
  chatMessageWindowStore.patchProfile(profileId, patch);
}
