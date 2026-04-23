"use client";

import axios from "axios";
import { format } from "date-fns";
import { Pin, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useModal } from "@/hooks/use-modal-store";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { AnimatedSticker } from "@/components/ui/animated-sticker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
          className="flex items-start gap-2.5 rounded-lg border border-theme-border bg-theme-bg-edit-form/60 px-3 py-2.5 animate-pulse"
        >
          <div className="h-8 w-8 shrink-0 rounded-full border border-theme-border bg-white/10" />
          <div className="flex-1 space-y-2 py-0.5">
            <div className="h-3 w-1/3 rounded bg-white/10" />
            <div className="h-2.5 w-3/4 rounded bg-white/10" />
            <div className="h-2 w-1/4 rounded bg-white/10" />
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

  const queryKey =
    roomType === "channel"
      ? ["pinnedMessages", "channel", channelId]
      : ["pinnedMessages", "conversation", conversationId];

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
    staleTime: 1000 * 60,
  });

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
      queryClient.setQueryData<PinnedMessage[]>(
        queryKey,
        (old) => old?.filter((msg) => msg.id !== messageId) ?? [],
      );

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
        className="max-w-[560px]! overflow-hidden rounded-lg border border-theme-border bg-theme-bg-modal p-0 text-theme-text-subtle"
        closeButtonClassName="cursor-pointer rounded-md p-1 text-theme-text-subtle opacity-100 transition hover:bg-theme-bg-cancel-button hover:text-theme-text-light data-[state=open]:bg-transparent data-[state=open]:text-theme-text-subtle focus:ring-0 focus:ring-offset-0 focus:outline-none"
      >
        <DialogHeader className="px-5 pt-5 -mt-1 -mb-2 pb-0">
          <DialogTitle className="flex items-center -mb-2.5 gap-2 text-[22px] font-medium leading-none text-theme-text-primary">
            {t.modals.pinnedMessages.title}
          </DialogTitle>
          <DialogDescription className="pt-2.5 pb-1.5 text-[14px] leading-5 text-theme-text-subtle">
            {isLoading
              ? t.common.loading
              : `${pinnedMessages.length} ${t.modals.pinnedMessages.messageCount}`}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pt-0 pb-0">
          <div className="rounded-lg border border-theme-border bg-theme-bg-edit-form/35 p-2.5">
            <div className="scrollbar-ultra-thin max-h-[420px] overflow-y-auto pr-1">
              {isLoading ? (
                <MessageListSkeleton />
              ) : pinnedMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-theme-border bg-theme-bg-edit-form/55 px-4 py-8 text-center">
                  <Pin className="h-4.5 w-4.5 text-theme-text-subtle" />
                  <p className="text-sm text-theme-text-muted">
                    {t.modals.pinnedMessages.noMessages}
                  </p>
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
                        className="group flex items-start gap-2.5 rounded-lg border border-theme-border bg-theme-bg-edit-form/60 px-3 py-2.5 transition hover:bg-theme-bg-secondary/45"
                      >
                        <UserAvatar
                          src={author?.avatarAsset?.url || undefined}
                          profileId={authorProfileId}
                          showStatus={false}
                          className="h-8 w-8 shrink-0"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <p className="text-sm font-medium text-theme-accent-primary">
                                  {author?.username}
                                </p>
                                <span className="text-xs text-theme-text-muted">
                                  {format(
                                    new Date(message.createdAt),
                                    "MMM d, yyyy HH:mm",
                                  )}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => unpinMutation.mutate(message.id)}
                              disabled={unpinMutation.isPending}
                              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-theme-border bg-theme-bg-cancel-button text-theme-text-subtle opacity-80 transition hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                              title={t.chat.unpinMessage}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {message.sticker ? (
                            <div className="relative mt-1.5 h-16 w-16 overflow-hidden rounded-lg border border-theme-border bg-theme-bg-modal/60">
                              <AnimatedSticker
                                src={message.sticker.asset?.url || ""}
                                alt={message.sticker.name}
                                containerClassName="h-full w-full"
                                fallbackWidthPx={64}
                                fallbackHeightPx={64}
                              />
                            </div>
                          ) : isImage && message.attachmentAsset?.url ? (
                            <div className="relative mt-1.5 h-24 w-24 overflow-hidden rounded-lg border border-theme-border bg-theme-bg-modal/60">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={message.attachmentAsset.url}
                                alt={
                                  message.attachmentAsset.originalName ||
                                  "Image"
                                }
                                className="absolute inset-0 h-full w-full object-cover"
                                loading="lazy"
                                decoding="async"
                              />
                            </div>
                          ) : message.attachmentAsset?.url ? (
                            <div className="mt-1.5 inline-flex max-w-full rounded-md border border-theme-border bg-theme-bg-modal/60 px-2 py-1 text-sm text-theme-accent-primary">
                              <span className="truncate">
                                {message.fileName}
                              </span>
                            </div>
                          ) : (
                            <p
                              className={cn(
                                "mt-1.5 text-sm text-theme-text-light wrap-break-word",
                                message.content.length > 100 && "line-clamp-3",
                              )}
                            >
                              {message.content}
                            </p>
                          )}

                          <p className="mt-1.5 text-xs text-theme-text-muted">
                            Pinned{" "}
                            {format(
                              new Date(message.pinnedAt),
                              "MMM d 'at' HH:mm",
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-theme-border px-5 py-1">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            className="h-7 cursor-pointer rounded-lg bg-theme-bg-cancel-button px-3 text-[14px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
          >
            {t.common.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
