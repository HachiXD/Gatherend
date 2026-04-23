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
import { useState } from "react";
import { useTranslation } from "@/i18n";

export const DeleteCommunityPostCommentModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();

  const isModalOpen = isOpen && type === "deleteCommunityPostComment";
  const { onDeleteCommunityPostCommentConfirm } = data;

  const onClick = async () => {
    if (!onDeleteCommunityPostCommentConfirm) return;

    try {
      setIsLoading(true);
      await onDeleteCommunityPostCommentConfirm();
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (isLoading) return;
    onClose();
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-[400px]! overflow-hidden rounded-lg border border-theme-border bg-theme-bg-modal p-0 text-theme-text-subtle"
        closeButtonClassName="cursor-pointer rounded-md p-1 text-theme-text-subtle opacity-100 transition hover:bg-theme-bg-cancel-button hover:text-theme-text-light data-[state=open]:bg-transparent data-[state=open]:text-theme-text-subtle focus:ring-0 focus:ring-offset-0 focus:outline-none"
      >
        <DialogHeader className="px-5 pt-5 -mt-2 -mb-2 pb-0">
          <DialogTitle className="text-[22px] -mb-1 font-medium text-theme-text-primary">
            {t.modals.deleteCommunityPostComment.title}
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-[14px] text-theme-text-subtle">
            {t.modals.deleteCommunityPostComment.description}
          </DialogDescription>
        </DialogHeader>
        <div className="px-5 pt-0 pb-0">
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
            <p className="text-[14px] leading-relaxed text-theme-text-secondary">
              {t.modals.deleteCommunityPostComment.willBeDeleted}
            </p>
          </div>
        </div>
        <DialogFooter className="border-t border-theme-border px-5 py-1">
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={isLoading}
              onClick={handleClose}
              className="h-6.5 cursor-pointer rounded-lg border border-theme-border bg-theme-bg-cancel-button px-4 text-[14px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
            >
              {t.common.cancel}
            </Button>
            <Button
              type="button"
              disabled={isLoading}
              onClick={onClick}
              className="h-6.5 cursor-pointer rounded-lg border border-red-500/50 bg-red-500/80 px-4 text-[14px] text-theme-text-light hover:bg-red-600 hover:text-theme-text-light disabled:cursor-not-allowed disabled:opacity-70"
            >
              {t.common.delete}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
