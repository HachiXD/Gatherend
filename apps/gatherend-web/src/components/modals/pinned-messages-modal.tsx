"use client";

import axios from "axios";
import { format } from "date-fns";
import { X, Pin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { AnimatedSticker } from "@/components/ui/animated-sticker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/i18n";
import type {
  ClientAttachmentAsset,
  ClientSticker,
} from "@/types/uploaded-assets";
import type {
  ChannelMessage,
  DirectMessageWithSender,
} from "@/hooks/chat/types";
import { getMessageAuthor, getMessageOwnerProfileId } from "@/hooks/chat";

type PinnedMessage = (ChannelMessage | DirectMessageWithSender) & {
  pinnedAt: string;
  attachmentAsset?: ClientAttachmentAsset | null;
  fileName?: string | null;
  sticker?: ClientSticker | null;
};

function MessageListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-2 border border-theme-border bg-theme-bg-secondary/20 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_-1px_0_0_rgba(0,0,0,0.28),inset_0_-1px_0_rgba(0,0,0,0.28)] animate-pulse"
        >
          <div className="h-8 w-8 shrink-0 border border-theme-border bg-white/10" />
          <div className="flex-1 space-y-2 py-0.5">
            <div className="h-3 w-1/3 bg-white/10" />
            <div className="h-2.5 w-3/4 bg-white/10" />
            <div className="h-2 w-1/4 bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

export const PinnedMessagesModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const isModalOpen = isOpen && type === "pinnedMessages";
  const { channelId, conversationId, roomType } = data;

  // Query key basado en el tipo de room
  const queryKey =
    roomType === "channel"
      ? ["pinnedMessages", "channel", channelId]
      : ["pinnedMessages", "conversation", conversationId];

  // useQuery para obtener mensajes fijados
  const { data: pinnedMessages = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const url =
        roomType === "channel"
          ? `/api/messages/pinned?channelId=${channelId}`
          : `/api/direct-messages/pinned?conversationId=${conversationId}`;
      const response = await axios.get<PinnedMessage[]>(url);
      return response.data;
    },
    enabled: isModalOpen && !!(channelId || conversationId),
    staleTime: 1000 * 60, // 1 minuto
  });

  // useMutation para desfijar mensajes
  const unpinMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const url =
        roomType === "channel"
          ? `/api/messages/${messageId}/pin?channelId=${channelId}`
          : `/api/direct-messages/${messageId}/pin?conversationId=${conversationId}`;
      await axios.delete(url);
      return messageId;
    },
    onSuccess: (messageId) => {
      // Actualizar cache optimistamente
      queryClient.setQueryData<PinnedMessage[]>(
        queryKey,
        (old) => old?.filter((msg) => msg.id !== messageId) ?? [],
      );
      // También invalidar la query de mensajes del chat para reflejar el cambio
      if (channelId) {
        queryClient.invalidateQueries({
          queryKey: ["chat", "channel", channelId],
        });
      }
      if (conversationId) {
        queryClient.invalidateQueries({
          queryKey: ["chat", "conversation", conversationId],
        });
      }
    },
    onError: (error) => {
      console.error("Error unpinning message:", error);
    },
  });

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-[500px]! overflow-hidden rounded-none border border-theme-border bg-theme-bg-modal p-0 text-theme-text-subtle"
        closeButtonClassName="cursor-pointer rounded-none p-1 text-theme-text-subtle opacity-100 transition hover:text-theme-text-light data-[state=open]:bg-transparent data-[state=open]:text-theme-text-subtle focus:ring-0 focus:ring-offset-0 focus:outline-none"
      >
        <DialogHeader className="px-6 pt-2 -mb-5">
          <DialogTitle className="flex items-center justify-center gap-2 text-2xl font-bold">
            {t.modals.pinnedMessages.title}
          </DialogTitle>
          <DialogDescription className="-mt-2 text-center text-[15px] text-theme-text-subtle">
            {pinnedMessages.length} {t.modals.pinnedMessages.messageCount}
          </DialogDescription>
        </DialogHeader>

        <div className="scrollbar-ultra-thin max-h-[500px] space-y-2 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <MessageListSkeleton />
          ) : pinnedMessages.length === 0 ? (
            <div className="border border-theme-border-subtle bg-theme-bg-edit-form/35 px-3 py-6 text-center text-sm text-theme-text-muted">
              {t.modals.pinnedMessages.noMessages}
            </div>
          ) : (
            <div className="space-y-2">
              {pinnedMessages.map((message) => {
                const author = getMessageAuthor(message, {
                  fallbackLabel: t.chat.deletedMember,
                });
                const authorProfileId =
                  getMessageOwnerProfileId(message) || undefined;
                const isImage =
                  message.attachmentAsset?.mimeType?.startsWith("image/");

                return (
                  <div
                    key={message.id}
                    className="group relative flex items-start gap-2 border border-theme-border bg-theme-bg-secondary/20 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_-1px_0_0_rgba(0,0,0,0.28),inset_0_-1px_0_rgba(0,0,0,0.28)] transition hover:bg-theme-bg-tertiary/40"
                  >
                    <UserAvatar
                      src={author?.avatarAsset?.url || undefined}
                      profileId={authorProfileId}
                      showStatus={false}
                      className="h-8 w-8 shrink-0"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-x-2">
                        <p className="text-sm font-semibold text-theme-accent-primary">
                          {author?.username}
                        </p>
                        <span className="text-xs text-theme-text-muted">
                          {format(
                            new Date(message.createdAt),
                            "MMM d, yyyy HH:mm",
                          )}
                        </span>
                      </div>

                      {message.sticker ? (
                        <div className="relative mt-1 h-16 w-16">
                          <AnimatedSticker
                            src={message.sticker.asset?.url || ""}
                            alt={message.sticker.name}
                            containerClassName="h-full w-full"
                            fallbackWidthPx={64}
                            fallbackHeightPx={64}
                          />
                        </div>
                      ) : isImage && message.attachmentAsset?.url ? (
                        <div className="relative mt-1 h-24 w-24 overflow-hidden border border-theme-border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={message.attachmentAsset.url}
                            alt={
                              message.attachmentAsset.originalName || "Image"
                            }
                            className="absolute inset-0 h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                      ) : message.attachmentAsset?.url ? (
                        <p className="mt-0.5 cursor-pointer text-sm text-theme-accent-primary hover:underline">
                          📎 {message.fileName}
                        </p>
                      ) : (
                        <p
                          className={cn(
                            "mt-0.5 text-sm text-theme-text-light wrap-break-word",
                            message.content.length > 100 && "line-clamp-3",
                          )}
                        >
                          {message.content}
                        </p>
                      )}

                      <p className="mt-0.5 text-xs italic text-theme-text-muted">
                        Pinned{" "}
                        {format(new Date(message.pinnedAt), "MMM d 'at' HH:mm")}
                      </p>
                    </div>

                    <button
                      onClick={() => unpinMutation.mutate(message.id)}
                      disabled={unpinMutation.isPending}
                      className="shrink-0 cursor-pointer p-1 text-theme-text-subtle opacity-0 transition hover:text-theme-text-light group-hover:opacity-100 disabled:opacity-50"
                      title={t.chat.unpinMessage}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!isLoading && pinnedMessages.length > 0 && (
          <div className="border-t border-theme-border bg-theme-bg-secondary/40 px-4 py-1.5">
            <p className="text-center text-xs text-theme-text-muted">
              {pinnedMessages.length} {t.modals.pinnedMessages.messageCount}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
