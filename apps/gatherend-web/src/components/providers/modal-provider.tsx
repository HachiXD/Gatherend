"use client";

import { CreateBoardModal } from "@/components/modals/create-board-modal";
import { CreateCommunityPostModal } from "@/components/modals/create-community-post-modal";
import { InviteModal } from "@/components/modals/invite-modal";
import { CreateChannelModal } from "@/components/modals/create-channel-modal";
import { EditChannelModal } from "@/components/modals/edit-channel-modal";
import { DeleteChannelModal } from "@/components/modals/delete-channel-modal";
import { LeaveBoardModal } from "@/components/modals/leave-board-modal";
import { DeleteMessageModal } from "@/components/modals/delete-message-modal";
import { AddFriendModal } from "@/components/modals/add-friend-modal";
import { PinnedMessagesModal } from "@/components/modals/pinned-messages-modal";
import { ReportMessageModal } from "@/components/modals/report-message-modal";
import { ReportBoardModal } from "@/components/modals/report-board-modal";
import { ReportProfileModal } from "@/components/modals/report-profile-modal";
import { ReportCommunityModal } from "@/components/modals/report-community-modal";
import { ReportCommunityPostModal } from "@/components/modals/report-community-post-modal";
import { DeleteCommunityPostModal } from "@/components/modals/delete-community-post-modal";
import { DeleteCommunityPostCommentModal } from "@/components/modals/delete-community-post-comment-modal";

export const ModalProvider = () => {
  const isMounted = typeof window !== "undefined";

  if (!isMounted) {
    return null;
  }

  return (
    <>
      <CreateBoardModal />
      <CreateCommunityPostModal />
      <InviteModal />
      <CreateChannelModal />
      <EditChannelModal />
      <DeleteChannelModal />
      <LeaveBoardModal />
      <DeleteMessageModal />
      <AddFriendModal />
      <PinnedMessagesModal />
      <ReportMessageModal />
      <ReportBoardModal />
      <ReportProfileModal />
      <ReportCommunityModal />
      <ReportCommunityPostModal />
      <DeleteCommunityPostModal />
      <DeleteCommunityPostCommentModal />
    </>
  );
};
