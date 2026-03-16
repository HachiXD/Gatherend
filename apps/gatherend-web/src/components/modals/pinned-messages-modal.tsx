"use client";

import axios from "axios";
import { format } from "date-fns";
import { X, Pin, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { AnimatedSticker } from "@/components/ui/animated-sticker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/i18n";
import type {
  ClientAttachmentAsset,
  ClientProfileSummary,
  ClientSticker,
} from "@/types/uploaded-assets";

interface PinnedMessage {
  id: string;
  content: string;
  createdAt: string;
  pinnedAt: string;
  attachmentAsset?: ClientAttachmentAsset | null;
  fileName?: string | null;
  sticker?: ClientSticker | null;
  member?: {
    profile: ClientProfileSummary;
  };
  sender?: ClientProfileSummary;
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
      <DialogContent className="bg-theme-bg-modal !max-w-[500px] text-theme-text-subtle p-0 overflow-hidden border-theme-border-primary">
        <DialogHeader className="pt-8 px-6">
          <DialogTitle className="text-2xl text-center font-bold flex items-center justify-center gap-2 text-theme-text-subtle">
            <Pin className="h-6 w-6" />
            {t.modals.pinnedMessages.title}
          </DialogTitle>
          <DialogDescription className="text-center text-[15px] text-theme-text-subtle">
            {pinnedMessages.length} {t.modals.pinnedMessages.messageCount}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[500px] px-6 pb-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-theme-accent-primary" />
            </div>
          ) : pinnedMessages.length === 0 ? (
            <div className="text-center py-10 text-theme-text-subtle">
              {t.modals.pinnedMessages.noMessages}
            </div>
          ) : (
            <div className="space-y-4">
              {pinnedMessages.map((message) => {
                const author = message.member?.profile || message.sender;
                const isImage = message.attachmentAsset?.mimeType?.startsWith(
                  "image/",
                );

                return (
                  <div
                    key={message.id}
                    className="group relative flex gap-x-3 p-3 rounded-md bg-theme-bg-tertiary/30 hover:bg-theme-bg-tertiary/50 transition border border-theme-border-primary/30"
                  >
                    <UserAvatar
                      src={author?.avatarAsset?.url || undefined}
                      profileId={author?.id}
                      showStatus={false}
                      className="h-10 w-10"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-x-2">
                        <p className="font-semibold text-sm text-theme-accent-primary">
                          {author?.username}
                        </p>
                        <span className="text-xs text-theme-text-subtle">
                          {format(
                            new Date(message.createdAt),
                            "MMM d, yyyy HH:mm",
                          )}
                        </span>
                      </div>

                      {message.sticker ? (
                        <div className="mt-2">
                          <div className="relative h-20 w-20">
                            <AnimatedSticker
                              src={message.sticker.asset?.url || ""}
                              alt={message.sticker.name}
                              containerClassName="h-full w-full"
                              fallbackWidthPx={80}
                              fallbackHeightPx={80}
                            />
                          </div>
                        </div>
                      ) : isImage && message.attachmentAsset?.url ? (
                        <div className="mt-2">
                          <div className="relative h-32 w-32 rounded overflow-hidden border border-theme-border-primary/50">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={message.attachmentAsset.url}
                              alt={message.attachmentAsset.originalName || "Image"}
                              className="absolute inset-0 h-full w-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                        </div>
                      ) : message.attachmentAsset?.url ? (
                        <p className="text-sm text-theme-accent-primary mt-1 hover:underline cursor-pointer">
                          📎 {message.fileName}
                        </p>
                      ) : (
                        <p
                          className={cn(
                            "text-sm text-theme-text-light mt-1 wrap-break-word",
                            message.content.length > 100 && "line-clamp-3",
                          )}
                        >
                          {message.content}
                        </p>
                      )}

                      <p className="text-xs text-theme-text-subtle mt-1 italic">
                        Pinned{" "}
                        {format(new Date(message.pinnedAt), "MMM d 'at' HH:mm")}
                      </p>
                    </div>

                    <button
                      onClick={() => unpinMutation.mutate(message.id)}
                      disabled={unpinMutation.isPending}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition p-1 rounded hover:bg-theme-bg-quaternary text-theme-text-subtle disabled:opacity-50"
                      title={t.chat.unpinMessage}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
