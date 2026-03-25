"use client";

import { useQueryClient, QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { ClientProfileSummary } from "@/types/uploaded-assets";

/**
 * Updates profile data within cached chat messages.
 * This ensures that when a user updates their profile (username, color, format, etc.),
 * the changes are reflected in all cached messages without requiring a hard refresh.
 */

interface ChatPage {
  items: ChatMessage[];
  nextCursor?: string | null;
  previousCursor?: string | null;
}

interface ChatMessage {
  id: string;
  messageSenderId?: string | null;
  messageSender?: CachedProfile | null;
  sender?: CachedProfile;
  member?: {
    id: string;
    profile: CachedProfile;
    [key: string]: unknown;
  };
  replyTo?: {
    id: string;
    messageSenderId?: string | null;
    messageSender?: CachedProfile | null;
    sender?: CachedProfile;
    member?: {
      id: string;
      profile: CachedProfile;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

interface InfiniteData {
  pages: ChatPage[];
  pageParams: unknown[];
}

type CachedProfile = ClientProfileSummary & {
  longDescription?: string | null;
};

type ProfileUpdateFields = Partial<
  Pick<
    CachedProfile,
    | "username"
    | "discriminator"
    | "avatarAsset"
    | "usernameColor"
    | "usernameFormat"
    | "profileTags"
    | "badge"
    | "badgeSticker"
    | "longDescription"
  >
>;

/**
 * Updates all profile references within a single message
 */
function updateMessageProfiles(
  message: ChatMessage,
  profileId: string,
  updates: ProfileUpdateFields
): ChatMessage {
  let updated = false;
  const newMessage = { ...message };

  // Update sender profile (for DMs)
  if (newMessage.sender?.id === profileId) {
    newMessage.sender = { ...newMessage.sender, ...updates };
    updated = true;
  }

  // Update messageSender (for channel messages)
  if (newMessage.messageSender?.id === profileId) {
    newMessage.messageSender = {
      ...newMessage.messageSender,
      ...updates,
    };
    updated = true;
  }

  // Update replyTo.messageSender / replyTo.sender / legacy replyTo.member.profile
  if (newMessage.replyTo) {
    if (newMessage.replyTo.messageSender?.id === profileId) {
      newMessage.replyTo = {
        ...newMessage.replyTo,
        messageSender: {
          ...newMessage.replyTo.messageSender,
          ...updates,
        },
      };
      updated = true;
    }
    if (newMessage.replyTo.sender?.id === profileId) {
      newMessage.replyTo = {
        ...newMessage.replyTo,
        sender: { ...newMessage.replyTo.sender, ...updates },
      };
      updated = true;
    }
    if (
      !newMessage.replyTo.messageSender &&
      newMessage.replyTo.member?.profile?.id === profileId
    ) {
      newMessage.replyTo = {
        ...newMessage.replyTo,
        member: {
          ...newMessage.replyTo.member,
          profile: { ...newMessage.replyTo.member.profile, ...updates },
        },
      };
      updated = true;
    }
  }

  return updated ? newMessage : message;
}

/**
 * Updates all profiles in an InfiniteData cache structure
 */
function updateInfiniteDataProfiles(
  data: InfiniteData,
  profileId: string,
  updates: ProfileUpdateFields
): InfiniteData {
  let anyPageUpdated = false;

  const newPages = data.pages.map((page) => {
    let pageUpdated = false;

    const newItems = page.items.map((message) => {
      const newMessage = updateMessageProfiles(message, profileId, updates);
      if (newMessage !== message) {
        pageUpdated = true;
      }
      return newMessage;
    });

    if (pageUpdated) {
      anyPageUpdated = true;
      return { ...page, items: newItems };
    }
    return page;
  });

  if (anyPageUpdated) {
    return { ...data, pages: newPages };
  }
  return data;
}

/**
 * Hook that provides a function to update cached profiles across all chat queries
 */
export function useUpdateCachedProfiles() {
  const queryClient = useQueryClient();

  const updateCachedProfiles = useCallback(
    (profileId: string, updates: ProfileUpdateFields) => {
      // Get all chat queries (both channel and conversation types)
      const chatQueries = queryClient.getQueriesData<InfiniteData>({
        queryKey: ["chat"],
      });

      // Update each chat query's cached data
      chatQueries.forEach(([queryKey, data]) => {
        if (!data) {
          return;
        }

        const updatedData = updateInfiniteDataProfiles(
          data,
          profileId,
          updates,
        );

        // Only update if data actually changed
        if (updatedData !== data) {
          queryClient.setQueryData(queryKey, updatedData);
        }
      });

      // Also update DM queries if they exist with different key pattern
      const dmQueries = queryClient.getQueriesData<InfiniteData>({
        queryKey: ["direct-messages"],
      });

      dmQueries.forEach(([queryKey, data]) => {
        if (!data) return;

        const updatedData = updateInfiniteDataProfiles(
          data,
          profileId,
          updates,
        );

        if (updatedData !== data) {
          queryClient.setQueryData(queryKey, updatedData);
        }
      });
    },
    [queryClient],
  );

  return { updateCachedProfiles };
}

/**
 * Utility function for updating cached profiles without hooks
 * Useful for one-off updates or in contexts where hooks aren't available
 */
export function updateCachedProfilesInQueryClient(
  queryClient: QueryClient,
  profileId: string,
  updates: ProfileUpdateFields,
) {
  // Get all chat queries
  const chatQueries = queryClient.getQueriesData<InfiniteData>({
    queryKey: ["chat"],
  });

  chatQueries.forEach(([queryKey, data]) => {
    if (!data) return;

    const updatedData = updateInfiniteDataProfiles(data, profileId, updates);

    if (updatedData !== data) {
      queryClient.setQueryData(queryKey, updatedData);
    }
  });

  // Also update DM queries
  const dmQueries = queryClient.getQueriesData<InfiniteData>({
    queryKey: ["direct-messages"],
  });

  dmQueries.forEach(([queryKey, data]) => {
    if (!data) return;

    const updatedData = updateInfiniteDataProfiles(data, profileId, updates);

    if (updatedData !== data) {
      queryClient.setQueryData(queryKey, updatedData);
    }
  });
}
