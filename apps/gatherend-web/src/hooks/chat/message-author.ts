import type { ClientProfileSummary } from "@/types/uploaded-assets";
import type { ChannelMessage, ChatMessage, ChatReplyTarget } from "./types";

export const MISSING_MESSAGE_AUTHOR_ID = "__deleted_member__";
export const DEFAULT_MISSING_MESSAGE_AUTHOR_LABEL = "Deleted member";

function createMissingMessageAuthor(
  fallbackLabel: string = DEFAULT_MISSING_MESSAGE_AUTHOR_LABEL,
): ClientProfileSummary {
  return {
    id: MISSING_MESSAGE_AUTHOR_ID,
    username: fallbackLabel,
    discriminator: null,
    usernameColor: null,
    profileTags: [],
    badge: null,
    usernameFormat: null,
    avatarAsset: null,
    badgeSticker: null,
  };
}

export function isChannelMessage(message: ChatMessage): message is ChannelMessage {
  return "messageSender" in message || "messageSenderId" in message;
}

export function isMissingMessageAuthor(
  profile: ClientProfileSummary | null | undefined,
): boolean {
  return profile?.id === MISSING_MESSAGE_AUTHOR_ID;
}

export function getMessageOwnerProfileId(message: ChatMessage): string | null {
  if (isChannelMessage(message)) {
    return (
      message.messageSenderId ??
      message.messageSender?.id ??
      message.member?.profile?.id ??
      null
    );
  }

  return message.sender?.id ?? null;
}

export function getReplyOwnerProfileId(
  replyTo: ChatReplyTarget | null | undefined,
): string | null {
  if (!replyTo) return null;

  return (
    replyTo.messageSenderId ??
    replyTo.messageSender?.id ??
    replyTo.sender?.id ??
    replyTo.member?.profile?.id ??
    null
  );
}

export function getMessageAuthor(
  message: ChatMessage,
  options?: { fallbackLabel?: string; includeFallback?: boolean },
): ClientProfileSummary | null {
  const includeFallback = options?.includeFallback ?? true;
  const fallbackLabel = options?.fallbackLabel;

  const author = isChannelMessage(message)
    ? message.messageSender ?? message.member?.profile ?? null
    : message.sender ?? null;

  if (author || !includeFallback) {
    return author;
  }

  return createMissingMessageAuthor(fallbackLabel);
}

export function getReplyAuthor(
  replyTo: ChatReplyTarget | null | undefined,
  options?: { fallbackLabel?: string; includeFallback?: boolean },
): ClientProfileSummary | null {
  if (!replyTo) return null;

  const includeFallback = options?.includeFallback ?? true;
  const fallbackLabel = options?.fallbackLabel;
  const author =
    replyTo.messageSender ?? replyTo.sender ?? replyTo.member?.profile ?? null;

  if (author || !includeFallback) {
    return author;
  }

  return createMissingMessageAuthor(fallbackLabel);
}
