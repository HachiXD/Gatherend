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

  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent className="bg-theme-bg-modal !max-w-[400px] overflow-hidden p-0 text-theme-text-subtle">
        <DialogHeader className="px-6 pt-8">
          <DialogTitle className="text-center text-2xl font-bold">
            Delete Comment
          </DialogTitle>
          <DialogDescription className="text-center text-[15px] text-theme-text-tertiary">
            This will remove the comment from the post thread.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="bg-theme-bg-modal px-6 py-4">
          <div className="flex w-full items-center justify-center gap-20">
            <Button
              disabled={isLoading}
              onClick={onClose}
              className="cursor-pointer bg-theme-bg-cancel-button text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
            >
              Cancel
            </Button>
            <Button
              disabled={isLoading}
              onClick={onClick}
              className="cursor-pointer bg-red-500 text-theme-text-light hover:bg-red-600 hover:text-theme-text-light"
            >
              Delete
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
