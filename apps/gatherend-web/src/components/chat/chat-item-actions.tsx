"use client";

import { memo, useCallback, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Member, MemberRole } from "@prisma/client";
import type { ClientProfile } from "@/hooks/use-current-profile";
import {
  Edit,
  Trash,
  ChevronDown,
  IterationCw,
  Pin,
  Smile,
  Download,
  TriangleAlert,
} from "lucide-react";
import { ActionTooltip } from "../action-tooltip";
import { useModal } from "@/hooks/use-modal-store";
import { useAddReaction, useRemoveReaction } from "@/hooks/use-reactions";
import { useCloneSticker } from "@/hooks/use-clone-sticker";
import { useReplyStore } from "@/hooks/use-reply-store";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import axios from "axios";
import { useTokenGetter } from "@/components/providers/token-manager-provider";
import { getExpressAxiosConfig } from "@/lib/express-fetch";
import type {
  ClientAttachmentAsset,
  ClientProfileSummary,
  ClientSticker,
} from "@/types/uploaded-assets";

interface ChatItemActionsProps {
  id: string;
  content: string;
  attachmentAsset: ClientAttachmentAsset | null;
  sticker?: ClientSticker | null;
  reactions: Array<{
    id: string;
    emoji: string;
    profileId: string;
    profile: {
      id: string;
      username: string;
    };
  }>;
  deleted: boolean;
  currentProfile: ClientProfile;
  currentMember?: Member | null;
  member?: {
    id: string;
    role: MemberRole;
    profile: ClientProfileSummary;
  };
  sender: ClientProfileSummary;
  apiUrl: string;
  socketQuery: Record<string, string>;
  pinned: boolean;
  isLastMessage: boolean;
  onStartEdit: () => void;
}

export const ChatItemActions = memo(function ChatItemActions({
  id,
  content,
  attachmentAsset,
  sticker,
  reactions,
  deleted,
  currentProfile,
  currentMember,
  member,
  sender,
  apiUrl,
  socketQuery,
  pinned,
  isLastMessage,
  onStartEdit,
}: ChatItemActionsProps) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [emojiPickerPosition, setEmojiPickerPosition] = useState({
    top: 0,
    left: 0,
  });
  const [isPinned, setIsPinned] = useState(pinned);

  const moreMenuRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiPickerPortalRef = useRef<HTMLDivElement>(null);

  // Solo suscribirse a la acción para evitar re-renders cuando cambia el estado global del modal.
  const onOpen = useModal(useCallback((state) => state.onOpen, []));
  const queryClient = useQueryClient();
  const { mutate: cloneSticker, isPending: isCloningSticker } =
    useCloneSticker();
  const { setReplyingTo } = useReplyStore();
  const { triggerScroll } = useScrollToBottom();
  const { t } = useTranslation();
  const { mutate: addReaction } = useAddReaction();
  const { mutate: removeReaction } = useRemoveReaction();
  const getToken = useTokenGetter();

  const isChannel = !!member;
  const channelId = socketQuery.channelId as string | undefined;
  const conversationId = socketQuery.conversationId as string | undefined;
  const authorProfile = isChannel ? member!.profile : sender;
  const fileUrl = attachmentAsset?.url || null;
  const fileName = attachmentAsset?.originalName || null;

  const isOwnMessage = isChannel
    ? currentMember?.id === member?.id
    : currentProfile.id === sender.id;

  // Permissions
  let canDeleteMessage = false;
  let canEditMessage = false;
  let canPinMessage = false;

  if (isChannel) {
    const isOwner = currentMember?.role === MemberRole.OWNER;
    const isAdmin = currentMember?.role === MemberRole.ADMIN;
    const isModerator = currentMember?.role === MemberRole.MODERATOR;

    canDeleteMessage =
      !deleted && (isOwner || isAdmin || isModerator || isOwnMessage);
    canEditMessage = !deleted && isOwnMessage && !fileUrl && !sticker;
    canPinMessage = !deleted && (isOwner || isAdmin || isModerator);
  } else {
    canDeleteMessage = !deleted && isOwnMessage;
    canEditMessage = !deleted && isOwnMessage && !fileUrl && !sticker;
    canPinMessage = !deleted;
  }

  const handleReply = () => {
    const roomId = channelId || conversationId;
    if (!roomId) return;

    setReplyingTo(
      {
        id,
        content,
        sender: authorProfile,
        attachmentAsset,
        fileName,
        sticker,
      },
      roomId
    );
    triggerScroll();
  };

  const handleTogglePin = async () => {
    try {
      const url = isChannel
        ? `/api/messages/${id}/pin?channelId=${channelId}`
        : `/api/direct-messages/${id}/pin?conversationId=${conversationId}`;

      const token = await getToken();
      if (isPinned) {
        await axios.delete(url, getExpressAxiosConfig(currentProfile.id, token));
        setIsPinned(false);
      } else {
        await axios.post(
          url,
          {},
          getExpressAxiosConfig(currentProfile.id, token)
        );
        setIsPinned(true);
      }

      const pinnedQueryKey = isChannel
        ? ["pinnedMessages", "channel", channelId]
        : ["pinnedMessages", "conversation", conversationId];
      queryClient.invalidateQueries({ queryKey: pinnedQueryKey });
      setShowMoreMenu(false);
    } catch (error) {
      console.error("Error toggling pin:", error);
    }
  };

  return (
    <div
      className={cn(
        "items-center gap-x-2 absolute p-1 -top-2 right-5 bg-theme-toolbar-bg border border-theme-toolbar-border rounded-sm z-10",
        showMoreMenu || showEmojiPicker
          ? "flex"
          : "hidden group-hover:flex hover:flex"
      )}
    >
      {!deleted && (
        <ActionTooltip label={t.chat.reply}>
          <IterationCw
            onClick={handleReply}
            className="cursor-pointer ml-auto w-5 h-5 text-theme-toolbar-icon hover:text-theme-text-light transition"
          />
        </ActionTooltip>
      )}
      {canEditMessage && (
        <ActionTooltip label={t.chat.edit}>
          <Edit
            onClick={() => {
              onStartEdit();
              if (isLastMessage) {
                requestAnimationFrame(() => triggerScroll());
              }
            }}
            className="cursor-pointer ml-auto w-5 h-5 text-theme-toolbar-icon hover:text-theme-text-light transition"
          />
        </ActionTooltip>
      )}
      {sticker && !deleted && (
        <ActionTooltip label={t.chat.addToCollection}>
          <Download
            onClick={() => {
              cloneSticker({
                stickerId: sticker.id,
                profileId: currentProfile.id,
              });
            }}
            className={cn(
              "cursor-pointer ml-auto w-5 h-5 text-theme-toolbar-icon hover:text-theme-text-light transition",
              isCloningSticker && "opacity-50 cursor-not-allowed"
            )}
          />
        </ActionTooltip>
      )}
      {canDeleteMessage && (
        <ActionTooltip label={t.chat.delete}>
          <Trash
            onClick={() =>
              onOpen("deleteMessage", {
                apiUrl: `${apiUrl}/${id}`,
                query: socketQuery,
                profileId: currentProfile.id,
              })
            }
            className="cursor-pointer ml-auto w-5 h-5 text-theme-toolbar-icon hover:text-theme-text-light transition"
          />
        </ActionTooltip>
      )}
      {!deleted && (
        <div className="relative" ref={emojiPickerRef}>
          <ActionTooltip label={t.chat.addReaction}>
            <Smile
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setEmojiPickerPosition({
                  top: rect.top - 48,
                  left: rect.right - 220,
                });
                setShowEmojiPicker(!showEmojiPicker);
              }}
              className="cursor-pointer w-5 h-5 text-theme-toolbar-icon hover:text-theme-text-light transition"
            />
          </ActionTooltip>
          {showEmojiPicker &&
            createPortal(
              <div
                ref={emojiPickerPortalRef}
                className="fixed z-[9999] flex gap-1 p-2 bg-theme-dropdown-bg border border-theme-dropdown-border rounded-full shadow-lg"
                style={{
                  top: emojiPickerPosition.top,
                  left: emojiPickerPosition.left,
                }}
              >
                {["👍", "❤️", "😂", "💀", "😭", "🤑"].map((emoji) => {
                  const existingReaction = reactions.find(
                    (r) =>
                      r.emoji === emoji && r.profileId === currentProfile.id
                  );
                  return (
                    <button
                      key={emoji}
                      onClick={() => {
                        if (existingReaction) {
                          removeReaction({
                            reactionId: existingReaction.id,
                            profileId: currentProfile.id,
                            channelId,
                            conversationId,
                          });
                        } else {
                          addReaction({
                            emoji,
                            messageId: isChannel ? id : undefined,
                            directMessageId: !isChannel ? id : undefined,
                            profileId: currentProfile.id,
                            channelId,
                            conversationId,
                          });
                        }
                        setShowEmojiPicker(false);
                      }}
                      className="text-2xl hover:scale-125 cursor-pointer transition-transform"
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>,
              document.body
            )}
        </div>
      )}
      {/* More menu */}
      <div className="relative" ref={moreMenuRef}>
        <ActionTooltip label={t.chat.more}>
          <ChevronDown
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setMenuPosition({ top: rect.bottom + 8, left: rect.right - 192 });
              setShowMoreMenu(!showMoreMenu);
            }}
            className="cursor-pointer ml-auto w-5 h-5 text-theme-text-subtle hover:text-theme-text-light transition"
          />
        </ActionTooltip>
        {showMoreMenu && (
          <div
            className="fixed z-50 w-48 py-1 bg-theme-dropdown-bg border border-theme-dropdown-border rounded-md shadow-lg"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            {canPinMessage && (
              <button
                onClick={handleTogglePin}
                className="w-full flex items-center gap-2 px-3 py-1 text-sm cursor-pointer text-theme-text-subtle hover:bg-theme-dropdown-hover transition"
              >
                <Pin className="h-4 w-4" />
                <span>
                  {isPinned ? t.chat.unpinMessage : t.chat.pinMessage}
                </span>
              </button>
            )}
            {!deleted && !isOwnMessage && (
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onOpen("reportMessage", {
                    messageId: id,
                    messageContent: content,
                    messageType: isChannel ? "MESSAGE" : "DIRECT_MESSAGE",
                    authorProfile,
                    channelId,
                    conversationId,
                    attachmentAsset,
                    sticker,
                    profileId: currentProfile.id,
                  });
                }}
                className="w-full flex items-center gap-2 px-3 py-1 text-sm cursor-pointer text-red-400 hover:bg-theme-dropdown-hover transition"
              >
                <TriangleAlert className="h-4 w-4" />
                <span>{t.chat.reportMessage}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

