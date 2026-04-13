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
        className="max-w-[420px]! overflow-hidden rounded-none border border-theme-border bg-theme-bg-modal p-0 text-theme-text-subtle"
        closeButtonClassName="cursor-pointer rounded-none p-1 text-theme-text-subtle opacity-100 transition hover:text-theme-text-light data-[state=open]:bg-transparent data-[state=open]:text-theme-text-subtle focus:ring-0 focus:ring-offset-0 focus:outline-none"
      >
        <DialogHeader className="px-6 pt-2">
          <DialogTitle className="text-2xl text-center font-bold">
            {t.modals.deleteChannel.title}
          </DialogTitle>
          <DialogDescription className="text-center text-[15px] -mt-2 text-theme-text-subtle">
            {t.modals.deleteChannel.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6 pb-4 -mt-2.5">
          <div className="flex h-8 items-center justify-center border border-theme-border bg-theme-bg-edit-form/60 px-3">
            <p className="text-center text-[14px] leading-none text-theme-text-tertiary">
              <span className="font-semibold text-red-400">
                /{channel?.name}
              </span>{" "}
              {t.modals.deleteChannel.willBeDeleted}
            </p>
          </div>
        </div>

        <DialogFooter className="border-t border-theme-border bg-theme-bg-secondary/40 px-6 py-1.5 -mt-5.5">
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            className="h-6.5 cursor-pointer rounded-none bg-theme-bg-cancel-button px-3 text-[14px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
            onClick={handleClose}
          >
            {t.common.cancel}
          </Button>
          <Button
            type="button"
            disabled={isPending}
            className="h-6.5 cursor-pointer rounded-none border border-red-500/60 bg-red-500/80 px-3 text-[14px] text-theme-text-light hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
            onClick={onClick}
          >
            {t.common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
