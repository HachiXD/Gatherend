import { useQueryClient } from "@tanstack/react-query";
import { v4 as uuidv4 } from "uuid";
import type { ClientProfile } from "@/hooks/use-current-profile";
import { useCallback, useRef } from "react";
import type {
  ChannelMessage,
  ChatMessage,
  DirectMessageWithSender,
} from "@/hooks/chat/types";
import { chatMessageWindowStore } from "@/hooks/chat/chat-message-window-store";
import {
  setOptimisticTimeout,
  clearOptimisticTimeout,
} from "./use-chat-socket";
import { logger } from "@/lib/logger";
import type {
  ClientAttachmentAsset,
  ClientSticker,
} from "@/types/uploaded-assets";

export type ServerMessage = (ChannelMessage | DirectMessageWithSender) & {
  tempId?: string;
};

// Timeout before marking message as failed (10 seconds)
const OPTIMISTIC_MESSAGE_TIMEOUT = 10000;

type OptimisticMessage =
  | (ChannelMessage & {
      createdAt: Date;
      updatedAt: Date;
      attachmentAssetId: string | null;
      attachmentAsset: ClientAttachmentAsset | null;
      sticker?: ClientSticker | null;
      isOptimistic: true;
      tempId: string;
      isFailed?: boolean;
    })
  | (DirectMessageWithSender & {
      createdAt: Date;
      updatedAt: Date;
      attachmentAssetId: string | null;
      attachmentAsset: ClientAttachmentAsset | null;
      sticker?: ClientSticker | null;
      isOptimistic: true;
      tempId: string;
      isFailed?: boolean;
    });

interface OptimisticMessageBase {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  deleted: boolean;
  attachmentAssetId: null;
  attachmentAsset: ClientAttachmentAsset | null;
  sticker?: ClientSticker | null;
  isOptimistic: true;
  tempId: string;
  isFailed?: boolean;
}

const buildOptimisticMessage = (
  queryKey: string[],
  tempId: string,
  content: string,
  now: Date,
  currentProfile: ClientProfile,
  sticker?: ClientSticker,
): OptimisticMessage => {
  const base: OptimisticMessageBase = {
    id: tempId,
    content,
    createdAt: now,
    updatedAt: now,
    deleted: false,
    attachmentAssetId: null,
    attachmentAsset: null,
    sticker,
    isOptimistic: true,
    tempId,
    isFailed: false,
  };

  if (queryKey[1] === "channel") {
    return {
      ...base,
      messageSenderId: currentProfile.id,
      messageSender: currentProfile,
      member: null,
    };
  }

  return {
    ...base,
    sender: currentProfile,
  };
};

interface QueryPage {
  items: unknown[];
  nextCursor?: string | undefined;
}

interface InfiniteQueryData {
  pages: QueryPage[];
  pageParams: (string | undefined)[];
}

const getWindowKeyFromChatQueryKey = (queryKey: string[]): string | null => {
  if (queryKey.length < 3) return null;
  if (queryKey[0] !== "chat") return null;
  const roomType = queryKey[1];
  const roomId = queryKey[2];
  if (roomType !== "channel" && roomType !== "conversation") return null;
  if (typeof roomId !== "string" || roomId.length === 0) return null;
  return `chatWindow:${roomType}:${roomId}`;
};

export const useOptimisticMessages = () => {
  const queryClient = useQueryClient();
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const getNormalizedOptimisticNow = useCallback(
    (queryKey: string[]) => {
      // `isCompactMessage` in `chat-messages.tsx` uses `createdAt` proximity to decide compact mode.
      // If the user's device clock is behind the server, optimistic messages can look "older"
      // than the previous server message and incorrectly render as NotCompacted.
      // Normalize the optimistic timestamp to be >= the newest cached message timestamp.
      const nowMs = Date.now();
      const cached = queryClient.getQueryData<InfiniteQueryData>(queryKey);

      const firstPage = cached?.pages?.[0];
      const firstItem = Array.isArray(firstPage?.items)
        ? firstPage.items[0]
        : null;
      const firstCreatedAt = (firstItem as { createdAt?: string | Date } | null)
        ?.createdAt;

      const firstCreatedAtMs =
        firstCreatedAt instanceof Date
          ? firstCreatedAt.getTime()
          : typeof firstCreatedAt === "string"
            ? new Date(firstCreatedAt).getTime()
            : Number.NaN;

      if (Number.isFinite(firstCreatedAtMs)) {
        return new Date(Math.max(nowMs, firstCreatedAtMs + 1));
      }

      return new Date(nowMs);
    },
    [queryClient],
  );

  const removeOptimisticMessage = useCallback(
    (queryKey: string[], tempId: string) => {
      // Clear any existing timeout for this tempId (both local ref and global)
      const existingTimeout = timeoutsRef.current.get(tempId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        timeoutsRef.current.delete(tempId);
      }
      clearOptimisticTimeout(tempId);

      queryClient.setQueryData<InfiniteQueryData>(queryKey, (oldData) => {
        if (!oldData || !oldData.pages) return oldData;

        const newPages = oldData.pages.map((page) => ({
          ...page,
          items: page.items.filter((item) => {
            // Type guard: verificar si el item es un mensaje optimista
            if (
              typeof item === "object" &&
              item !== null &&
              "isOptimistic" in item &&
              "tempId" in item
            ) {
              // Si es optimista y tiene el tempId que buscamos, filtrarlo
              return (item as OptimisticMessage).tempId !== tempId;
            }
            // Si no es optimista, mantenerlo
            return true;
          }),
        }));

        return {
          ...oldData,
          pages: newPages,
        };
      });

      const windowKey = getWindowKeyFromChatQueryKey(queryKey);
      if (windowKey) {
        chatMessageWindowStore.removeById(windowKey, tempId);
      }
    },
    [queryClient],
  );

  const markMessageAsFailed = useCallback(
    (queryKey: string[], tempId: string) => {
      queryClient.setQueryData<InfiniteQueryData>(queryKey, (oldData) => {
        if (!oldData || !oldData.pages) return oldData;

        const newPages = oldData.pages.map((page) => ({
          ...page,
          items: page.items.map((item) => {
            if (
              typeof item === "object" &&
              item !== null &&
              "isOptimistic" in item &&
              "tempId" in item &&
              (item as OptimisticMessage).tempId === tempId
            ) {
              return { ...item, isFailed: true };
            }
            return item;
          }),
        }));

        return {
          ...oldData,
          pages: newPages,
        };
      });

      const windowKey = getWindowKeyFromChatQueryKey(queryKey);
      if (windowKey) {
        chatMessageWindowStore.updateById(
          windowKey,
          tempId,
          (prev) =>
            ({
              ...(prev as unknown as Record<string, unknown>),
              isFailed: true,
            }) as unknown as ChatMessage,
        );
      }
    },
    [queryClient],
  );

  const addOptimisticMessage = useCallback(
    (
      queryKey: string[],
      content: string,
      currentProfile: ClientProfile,
      sticker?: ClientSticker,
    ) => {
      const tempId = `optimistic-${uuidv4()}`;
      const now = getNormalizedOptimisticNow(queryKey);

      const optimisticMessage = buildOptimisticMessage(
        queryKey,
        tempId,
        content,
        now,
        currentProfile,
        sticker,
      );

      // Agregar el mensaje optimista al cache de React Query
      queryClient.setQueryData<InfiniteQueryData>(queryKey, (oldData) => {
        if (!oldData || !oldData.pages || oldData.pages.length === 0) {
          return {
            pages: [
              {
                items: [optimisticMessage],
                nextCursor: undefined,
              },
            ],
            pageParams: [undefined],
          };
        }

        const newPages = [...oldData.pages];
        const firstPage = { ...newPages[0] };

        // Defensive check: ensure items is an array
        const existingItems = Array.isArray(firstPage.items)
          ? firstPage.items
          : [];
        firstPage.items = [optimisticMessage, ...existingItems];
        newPages[0] = firstPage;

        return {
          ...oldData,
          pages: newPages,
        };
      });

      const windowKey = getWindowKeyFromChatQueryKey(queryKey);
      if (windowKey) {
        const live = chatMessageWindowStore.get(windowKey);
        const preferAfterCache = Boolean(live.hasMoreAfter);
        chatMessageWindowStore.upsertIncomingMessage(
          windowKey,
          optimisticMessage as unknown as ChatMessage,
          preferAfterCache ? { preferAfterCache: true } : undefined,
        );
      }

      // Set a timeout to mark as failed if not replaced by real message
      const timeout = setTimeout(() => {
        // Check if the optimistic message still exists (wasn't replaced by real message)
        const currentData =
          queryClient.getQueryData<InfiniteQueryData>(queryKey);
        if (currentData?.pages) {
          const stillExists = currentData.pages.some((page) =>
            page.items.some(
              (item) =>
                typeof item === "object" &&
                item !== null &&
                "isOptimistic" in item &&
                "tempId" in item &&
                (item as OptimisticMessage).tempId === tempId &&
                !(item as OptimisticMessage).isFailed, // Only if not already failed
            ),
          );

          if (stillExists) {
            logger.warn(
              `[optimistic] Marking message as failed after timeout: ${tempId}`,
            );
            markMessageAsFailed(queryKey, tempId);
          }
        }
        timeoutsRef.current.delete(tempId);
      }, OPTIMISTIC_MESSAGE_TIMEOUT);

      // Store timeout in both local ref AND global map (for socket handler to clear)
      timeoutsRef.current.set(tempId, timeout);
      setOptimisticTimeout(tempId, timeout);

      return tempId;
    },
    [queryClient, markMessageAsFailed, getNormalizedOptimisticNow],
  );

  // Reset a failed message to pending state (for retry)
  const resetFailedMessage = useCallback(
    (queryKey: string[], tempId: string) => {
      // Clear any existing timeout (both local ref and global)
      const existingTimeout = timeoutsRef.current.get(tempId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        timeoutsRef.current.delete(tempId);
      }
      clearOptimisticTimeout(tempId);

      queryClient.setQueryData<InfiniteQueryData>(queryKey, (oldData) => {
        if (!oldData || !oldData.pages) return oldData;

        const newPages = oldData.pages.map((page) => ({
          ...page,
          items: page.items.map((item) => {
            if (
              typeof item === "object" &&
              item !== null &&
              "isOptimistic" in item &&
              "tempId" in item &&
              (item as OptimisticMessage).tempId === tempId
            ) {
              return { ...item, isFailed: false };
            }
            return item;
          }),
        }));

        return {
          ...oldData,
          pages: newPages,
        };
      });

      const windowKey = getWindowKeyFromChatQueryKey(queryKey);
      if (windowKey) {
        chatMessageWindowStore.updateById(
          windowKey,
          tempId,
          (prev) =>
            ({
              ...(prev as unknown as Record<string, unknown>),
              isFailed: false,
            }) as unknown as ChatMessage,
        );
      }

      // Set a new timeout
      const timeout = setTimeout(() => {
        const currentData =
          queryClient.getQueryData<InfiniteQueryData>(queryKey);
        if (currentData?.pages) {
          const stillExists = currentData.pages.some((page) =>
            page.items.some(
              (item) =>
                typeof item === "object" &&
                item !== null &&
                "isOptimistic" in item &&
                "tempId" in item &&
                (item as OptimisticMessage).tempId === tempId &&
                !(item as OptimisticMessage).isFailed,
            ),
          );

          if (stillExists) {
            markMessageAsFailed(queryKey, tempId);
          }
        }
        timeoutsRef.current.delete(tempId);
      }, OPTIMISTIC_MESSAGE_TIMEOUT);

      // Store timeout in both local ref AND global map
      timeoutsRef.current.set(tempId, timeout);
      setOptimisticTimeout(tempId, timeout);
    },
    [queryClient, markMessageAsFailed],
  );

  // Confirm an optimistic message by replacing it with the server response
  // This is called when HTTP POST succeeds, providing immediate confirmation
  // without waiting for socket event
  const confirmOptimisticMessage = useCallback(
    (queryKey: string[], tempId: string, serverMessage: ServerMessage) => {
      // Clear the timeout immediately - message is confirmed
      const existingTimeout = timeoutsRef.current.get(tempId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        timeoutsRef.current.delete(tempId);
      }
      clearOptimisticTimeout(tempId);

      queryClient.setQueryData<InfiniteQueryData>(queryKey, (oldData) => {
        if (!oldData || !oldData.pages) return oldData;

        // Search all pages for the optimistic message
        for (let pageIndex = 0; pageIndex < oldData.pages.length; pageIndex++) {
          const page = oldData.pages[pageIndex];
          if (!Array.isArray(page.items)) continue;

          const optimisticIndex = page.items.findIndex(
            (item) =>
              typeof item === "object" &&
              item !== null &&
              "isOptimistic" in item &&
              "tempId" in item &&
              (item as OptimisticMessage).tempId === tempId,
          );

          if (optimisticIndex !== -1) {
            // Found the optimistic message - replace it with server message
            const newPages = [...oldData.pages];
            const newItems = [...page.items];

            // Create clean message without optimistic flags
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { tempId: _, ...cleanServerMessage } = serverMessage;
            newItems[optimisticIndex] = cleanServerMessage;

            newPages[pageIndex] = {
              ...page,
              items: newItems,
            };

            return {
              ...oldData,
              pages: newPages,
            };
          }
        }

        // Optimistic message not found - might have been replaced by socket already
        return oldData;
      });

      const windowKey = getWindowKeyFromChatQueryKey(queryKey);
      if (windowKey) {
        const live = chatMessageWindowStore.get(windowKey);
        const preferAfterCache = Boolean(live.hasMoreAfter);
        const { tempId: _tempId, ...cleanServerMessage } =
          serverMessage as unknown as { tempId?: string };

        chatMessageWindowStore.replaceOptimisticByTempId(
          windowKey,
          tempId,
          cleanServerMessage as unknown as ChatMessage,
        );

        chatMessageWindowStore.upsertById(
          windowKey,
          cleanServerMessage as unknown as ChatMessage,
          {
            insertIfMissing: true,
            ...(preferAfterCache ? { preferAfterCache: true } : {}),
          },
        );
      }
    },
    [queryClient],
  );

  return {
    addOptimisticMessage,
    removeOptimisticMessage,
    markMessageAsFailed,
    resetFailedMessage,
    confirmOptimisticMessage,
  };
};
