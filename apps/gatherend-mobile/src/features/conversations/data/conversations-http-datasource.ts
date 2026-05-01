import {
  nextApiFetch,
  readNextApiError,
} from "@/src/services/next-api/next-api-fetch";
import { expressFetch } from "@/src/services/express/express-fetch";
import type { Conversation } from "../domain/conversation";
import type { DirectMessage, DirectMessagesPage } from "../domain/direct-message";

export type ConversationsHttpDataSource = {
  getConversation: (conversationId: string, profileId: string) => Promise<Conversation>;
  getDirectMessages: (input: {
    conversationId: string;
    cursor?: string;
    direction?: "before" | "after";
    profileId: string;
  }) => Promise<DirectMessagesPage>;
  hideConversation: (conversationId: string) => Promise<void>;
  listConversations: () => Promise<Conversation[]>;
  sendDirectMessage: (input: {
    conversationId: string;
    content: string;
    profileId: string;
    tempId: string;
    attachmentAssetId?: string;
    stickerId?: string;
  }) => Promise<DirectMessage>;
};

function formatConversation(
  conversation: Omit<Conversation, "isOne" | "lastMessage" | "otherProfile">,
  profileId: string,
): Conversation {
  const isOne = conversation.profileOneId === profileId;

  return {
    ...conversation,
    isOne,
    otherProfile: isOne ? conversation.profileTwo : conversation.profileOne,
    lastMessage: null,
  };
}

export function createConversationsHttpDataSource(): ConversationsHttpDataSource {
  return {
    async getConversation(conversationId, profileId) {
      const response = await nextApiFetch(`/api/conversations/${conversationId}`);

      if (!response.ok) {
        throw new Error(
          await readNextApiError(response, "Failed to fetch conversation"),
        );
      }

      return formatConversation(await response.json(), profileId);
    },

    async getDirectMessages({
      conversationId,
      cursor,
      direction = "before",
      profileId,
    }) {
      const searchParams = new URLSearchParams({
        conversationId,
      });

      if (cursor) {
        searchParams.set("cursor", cursor);
        searchParams.set("direction", direction);
      }

      const response = await expressFetch(
        `/direct-messages?${searchParams.toString()}`,
        { profileId },
      );

      if (!response.ok) {
        throw new Error(
          await readNextApiError(response, "Failed to fetch direct messages"),
        );
      }

      return (await response.json()) as DirectMessagesPage;
    },

    async hideConversation(conversationId) {
      const response = await nextApiFetch(
        `/api/conversations/${conversationId}/hide`,
        {
          method: "PATCH",
        },
      );

      if (!response.ok) {
        throw new Error(
          await readNextApiError(response, "Failed to hide conversation"),
        );
      }
    },

    async listConversations() {
      const response = await nextApiFetch("/api/conversations/list");

      if (!response.ok) {
        throw new Error(
          await readNextApiError(response, "Failed to fetch conversations"),
        );
      }

      return (await response.json()) as Conversation[];
    },

    async sendDirectMessage({
      conversationId,
      content,
      profileId,
      tempId,
      attachmentAssetId,
      stickerId,
    }) {
      const searchParams = new URLSearchParams({
        conversationId,
      });

      const response = await expressFetch(
        `/direct-messages?${searchParams.toString()}`,
        {
          method: "POST",
          profileId,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content,
            tempId,
            attachmentAssetId,
            stickerId,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          await readNextApiError(response, "Failed to send direct message"),
        );
      }

      return (await response.json()) as DirectMessage;
    },
  };
}
