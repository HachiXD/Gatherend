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
import { useDeleteChannel, useBoardData } from "@/hooks/use-board-data";
import { ChannelType } from "@prisma/client";
import { logger } from "@/lib/logger";
import { useTranslation } from "@/i18n";

export const DeleteChannelModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const router = useRouter();
  const params = useParams();
  const { t } = useTranslation();

  const isModalOpen = isOpen && type === "deleteChannel";
  const { board, boardId: dataBoardId, channel } = data;

  // Usar boardId del data (preferir boardId directo sobre board.id)
  const boardId = dataBoardId || board?.id;

  // Obtener datos del board desde React Query cache
  const { data: boardData } = useBoardData(boardId || "");

  // Usar useMutation con optimistic update
  const { mutate: deleteChannel, isPending } = useDeleteChannel();

  // Detectar si el usuario está actualmente en el canal que se va a borrar
  const currentChannelId = params?.roomId as string | undefined;
  const isInDeletedChannel = currentChannelId === channel?.id;

  const onClick = () => {
    if (!channel?.id || !boardId) return;

    // Calcular el primer canal DENTRO del onClick para tener los datos más frescos
    // y antes de que el optimistic update los modifique
    const targetChannel = findFirstTextChannel(boardData, channel.id);

    deleteChannel(
      { channelId: channel.id, boardId },
      {
        onSuccess: () => {
          onClose();

          // Solo navegar si el usuario está en el canal que se borró
          if (isInDeletedChannel) {
            if (targetChannel) {
              router.push(`/boards/${boardId}/rooms/${targetChannel.id}`);
            } else {
              router.push(`/boards/${boardId}`);
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
      <DialogContent className="max-w-[420px]! overflow-hidden rounded-none border border-theme-border bg-theme-bg-modal p-0 text-theme-text-subtle">
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
            onClick={handleClose}
            className="h-6.5 cursor-pointer rounded-none bg-theme-bg-cancel-button px-3 text-[14px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
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

/**
 * Encuentra el primer canal de texto disponible en el board
 * Busca el canal TEXT con la posición más baja (excluyendo el que se borra)
 */
function findFirstTextChannel(
  boardData: ReturnType<typeof useBoardData>["data"],
  excludeChannelId: string,
): { id: string; name: string } | null {
  if (!boardData) return null;

  // Buscar el canal TEXT con la posición más baja
  const firstTextChannel = boardData.channels
    .filter((ch) => ch.type === ChannelType.TEXT && ch.id !== excludeChannelId)
    .sort((a, b) => a.position - b.position)[0];

  if (firstTextChannel) {
    return { id: firstTextChannel.id, name: firstTextChannel.name };
  }

  return null;
}
