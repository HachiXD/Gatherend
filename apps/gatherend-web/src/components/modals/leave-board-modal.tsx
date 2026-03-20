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
import { useState, useTransition } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/i18n";

export const LeaveBoardModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [, startTransition] = useTransition();
  const { t } = useTranslation();

  const isModalOpen = isOpen && type === "leaveBoard";
  const { board } = data;

  const [isLoading, setIsLoading] = useState(false);

  const onClick = async () => {
    try {
      setIsLoading(true);

      const response = await axios.post(`/api/boards/${board?.id}/leave`);
      const redirectUrl =
        typeof response.data?.redirectUrl === "string"
          ? response.data.redirectUrl
          : "/boards";

      // Invalidar queries de boards para reflejar que ya no es miembro
      await queryClient.invalidateQueries({ queryKey: ["user-boards"] });
      await queryClient.invalidateQueries({ queryKey: ["board", board?.id] });

      onClose();
      startTransition(() => {
        router.push(redirectUrl);
        router.refresh();
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent className="bg-theme-bg-modal text-theme-text-subtle p-0 overflow-hidden">
        <DialogHeader className="pt-8 px-6">
          <DialogTitle className="text-2xl text-center font-bold">
            {t.modals.leaveBoard.title}
          </DialogTitle>
          <DialogDescription className="text-center text-theme-text-tertiary">
            {t.modals.leaveBoard.description}{" "}
            <span className="font-semibold text-theme-accent-primary">
              {board?.name}
            </span>
            ?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="bg-theme-bg-modal px-6 py-4">
          <div className="flex items-center justify-center gap-20 w-full">
            <Button
              disabled={isLoading}
              onClick={onClose}
              className="bg-theme-bg-cancel-button hover:bg-theme-bg-cancel-button-hover cursor-pointer text-theme-text-subtle hover:text-theme-text-light"
            >
              {t.common.cancel}
            </Button>
            <Button
              disabled={isLoading}
              className="bg-red-500 cursor-pointer hover:bg-red-600 text-theme-text-light hover:text-theme-text-light"
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
