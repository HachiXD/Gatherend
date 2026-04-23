"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { Button } from "@/components/ui/button";
import { useRouter, useParams } from "next/navigation";
import { useDeleteChannel } from "@/hooks/use-board-data";
import { logger } from "@/lib/logger";
import { useTranslation } from "@/i18n";
import { useBoardSwitchSafe } from "@/contexts/board-switch-context";

export const DeleteChannelModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const router = useRouter();
  const params = useParams();
  const { t } = useTranslation();
  const boardSwitch = useBoardSwitchSafe();

  const isModalOpen = isOpen && type === "deleteChannel";
  const { board, boardId: dataBoardId, channel } = data;
  const boardId = dataBoardId || board?.id;

  const { mutate: deleteChannel, isPending } = useDeleteChannel();

  const currentChannelId = params?.roomId as string | undefined;
  const isInDeletedChannel = currentChannelId === channel?.id;

  const onClick = () => {
    if (!channel?.id || !boardId) return;

    const shouldGoToChannelsList = isInDeletedChannel;

    deleteChannel(
      { channelId: channel.id, boardId },
      {
        onSuccess: () => {
          onClose();

          if (shouldGoToChannelsList) {
            if (boardSwitch?.isClientNavigationEnabled) {
              boardSwitch.switchBoardView(
                boardId,
                { kind: "channels:list" },
                { history: "replace" },
              );
            } else {
              router.push(`/boards/${boardId}/channels`);
            }
          }
        },
        onError: (error) => {
          logger.error("Failed to delete channel:", error);
        },
      },
    );
  };

  const handleClose = () => {
    if (isPending) return;
    onClose();
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-[400px]! overflow-hidden rounded-lg border border-theme-border bg-theme-bg-modal p-0 text-theme-text-subtle"
        closeButtonClassName="cursor-pointer rounded-md p-0.5 text-theme-text-subtle opacity-100 transition hover:bg-theme-bg-cancel-button hover:text-theme-text-light data-[state=open]:bg-transparent data-[state=open]:text-theme-text-subtle focus:ring-0 focus:ring-offset-0 focus:outline-none"
      >
        <DialogHeader className="px-5 pt-5 -mt-2 -mb-2 pb-0">
          <DialogTitle className="text-[22px] -mb-1 font-medium text-theme-text-primary">
            {t.modals.deleteChannel.title}
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-[14px] text-theme-text-subtle">
            {t.modals.deleteChannel.description}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pt-0 pb-0">
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
            <p className="text-[14px] leading-relaxed text-theme-text-secondary">
              <span className="font-medium text-red-300">/{channel?.name}</span>{" "}
              {t.modals.deleteChannel.willBeDeleted}
            </p>
          </div>
        </div>

        <DialogFooter className="border-t border-theme-border px-5 py-1">
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              className="h-6.5 cursor-pointer rounded-lg border border-theme-border bg-theme-bg-cancel-button px-4 text-[14px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
              onClick={handleClose}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="button"
              disabled={isPending}
              className="h-6.5 cursor-pointer rounded-lg border border-red-500/50 bg-red-500/80 px-4 text-[14px] text-theme-text-light hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
              onClick={onClick}
            >
              {t.common.confirm}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
