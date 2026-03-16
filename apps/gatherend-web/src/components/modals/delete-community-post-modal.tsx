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
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { communityPostsKey } from "@/hooks/discovery/posts-feed/use-community-posts-feed";
import { communityOverviewKey } from "@/hooks/discovery/use-community-overview";

export const DeleteCommunityPostModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const isModalOpen = isOpen && type === "deleteCommunityPost";
  const { deleteCommunityPostId, deleteCommunityPostCommunityId } = data;

  const onClick = async () => {
    if (!deleteCommunityPostId || !deleteCommunityPostCommunityId) return;

    try {
      setIsLoading(true);
      await axios.delete(`/api/posts/${deleteCommunityPostId}`);

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: communityPostsKey(deleteCommunityPostCommunityId),
        }),
        queryClient.invalidateQueries({
          queryKey: communityOverviewKey(deleteCommunityPostCommunityId),
        }),
      ]);

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
            Delete Post
          </DialogTitle>
          <DialogDescription className="text-center text-[15px] text-theme-text-tertiary">
            This will remove the post from the community feed.
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
