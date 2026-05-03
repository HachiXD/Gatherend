import type { ChatReplyTarget, ClientProfileSummary , ChannelMessage } from "@/src/features/chat/types";
import type { ChatMessage } from "@/src/features/chat/lib/chat-message";

export const MISSING_MESSAGE_AUTHOR_ID = "__deleted_member__";
export const DEFAULT_MISSING_MESSAGE_AUTHOR_LABEL = "Deleted member";

function createMissingMessageAuthor(
  fallbackLabel = DEFAULT_MISSING_MESSAGE_AUTHOR_LABEL,
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

export function isChannelMessage(m: ChatMessage): m is ChannelMessage {
  return "messageSender" in m || "messageSenderId" in m;
}

export function isMissingMessageAuthor(
  profile: ClientProfileSummary | null | undefined,
): boolean {
  return profile?.id === MISSING_MESSAGE_AUTHOR_ID;
}

export function getMessageOwnerProfileId(m: ChatMessage): string | null {
  if (isChannelMessage(m)) {
    return m.messageSenderId ?? m.messageSender?.id ?? m.member?.profile?.id ?? null;
  }
  return m.senderId ?? m.sender?.id ?? null;
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
  m: ChatMessage,
  options?: { fallbackLabel?: string; includeFallback?: boolean },
): ClientProfileSummary | null {
  const includeFallback = options?.includeFallback ?? true;
  const fallbackLabel = options?.fallbackLabel;

  const author = isChannelMessage(m)
    ? m.messageSender ?? m.member?.profile ?? null
    : m.sender ?? null;

  if (author || !includeFallback) return author;
  return createMissingMessageAuthor(fallbackLabel);
}

export function getReplyAuthor(
  replyTo: ChatReplyTarget | null | undefined,
  options?: { fallbackLabel?: string; includeFallback?: boolean },
): ClientProfileSummary | null {
  if (!replyTo) return null;

  const includeFallback = options?.includeFallback ?? true;
  const fallbackLabel = options?.fallbackLabel;
  const author = replyTo.messageSender ?? replyTo.sender ?? replyTo.member?.profile ?? null;

  if (author || !includeFallback) return author;
  return createMissingMessageAuthor(fallbackLabel);
}
