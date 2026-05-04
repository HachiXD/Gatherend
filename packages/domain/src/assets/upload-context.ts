/**
 * Canonical upload context type.
 *
 * These strings are the HTTP API contract between clients (web, mobile) and
 * the Express upload endpoint. Keep in sync with:
 *   - apps/express/src/config/moderation.config.ts  (CONTEXT_TO_ASSET_CONTEXT, STORAGE_FOLDERS, ALWAYS_MODERATED_CONTEXTS)
 *   - apps/express/src/modules/upload/upload.routes.ts  (ALWAYS_MODERATED_CONTEXTS, CONTEXT_TO_ASSET_CONTEXT)
 */
export type UploadContext =
  | "board_image"
  | "board_banner"
  | "channel_image"
  | "community_post_image"
  | "community_post_comment_image"
  | "board_rules_image"
  | "profile_avatar"
  | "profile_banner"
  | "profile_card_image"
  | "message_attachment"
  | "dm_attachment"
  | "sticker"
  | "wiki_page_image";
