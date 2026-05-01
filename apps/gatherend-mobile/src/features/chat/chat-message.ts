import type { ChannelMessage } from "@/src/features/chat/types";
import type { DirectMessage } from "@/src/features/conversations/domain/direct-message";

export type ChatMessage = ChannelMessage | DirectMessage;
