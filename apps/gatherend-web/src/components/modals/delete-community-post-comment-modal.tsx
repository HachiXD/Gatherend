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

export const DeleteCommunityPostCommentModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const [isLoading, setIsLoading] = useState(false);

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
      <DialogContent className="max-w-[420px]! overflow-hidden rounded-none border border-theme-border bg-theme-bg-modal p-0 text-theme-text-subtle">
        <DialogHeader className="px-6 pt-2">
          <DialogTitle className="text-center text-2xl font-bold">
            Delete Comment
          </DialogTitle>
          <DialogDescription className="text-center -mt-2 text-[15px] text-theme-text-subtle">
            This will remove the comment from the post thread.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-6 pb-4 -mt-2.5">
          <div className="flex h-7 items-center justify-center border border-theme-border bg-theme-bg-edit-form/60 px-3">
            <p className="text-center text-[14px] leading-none text-theme-text-tertiary">
              This comment will be deleted permanently.
            </p>
          </div>
        </div>
        <DialogFooter className="border-t border-theme-border bg-theme-bg-secondary/40 px-6 py-1.5 -mt-5.5">
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={isLoading}
              onClick={handleClose}
              className="h-6 cursor-pointer rounded-none bg-theme-bg-cancel-button px-3 text-[14px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isLoading}
              onClick={onClick}
              className="h-6 cursor-pointer rounded-none border border-red-500/60 bg-red-500/80 px-3 text-[14px] text-theme-text-light hover:bg-red-600 hover:text-theme-text-light disabled:cursor-not-allowed disabled:opacity-70"
            >
              Delete
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
