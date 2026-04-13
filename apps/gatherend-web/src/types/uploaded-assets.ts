import type { JsonValue } from "@prisma/client/runtime/library";
import type { ChatBubbleStyle } from "@/lib/chat-bubble-style";

export interface ClientPublicAsset {
  id: string;
  width: number | null;
  height: number | null;
  dominantColor: string | null;
  url: string | null;
}

export interface ClientAttachmentAsset extends ClientPublicAsset {
  mimeType: string;
  sizeBytes: number | null;
  originalName: string | null;
}

export type ClientUploadedAsset = ClientPublicAsset;

export interface ClientStickerAssetRef {
  id: string;
  asset: ClientPublicAsset | null;
}

export interface ClientSticker {
  id: string;
  name: string;
  category: string;
  asset: ClientPublicAsset | null;
  uploaderId?: string | null;
  isCustom?: boolean;
}

export interface ClientProfileSummary {
  id: string;
  username: string;
  discriminator: string | null;
  usernameColor: JsonValue;
  profileTags: string[];
  badge: string | null;
  usernameFormat: JsonValue;
  chatBubbleStyle?: ChatBubbleStyle | null;
  avatarAsset: ClientPublicAsset | null;
  badgeSticker: ClientStickerAssetRef | null;
}
