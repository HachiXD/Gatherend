"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

import { GeneralTab } from "@/components/overlays/board-settings/tabs/general";
import { MembersTab } from "@/components/overlays/board-settings/tabs/members";
import { BansTab } from "@/components/overlays/board-settings/tabs/bans";
import { ModerationHistoryTab } from "@/components/overlays/board-settings/tabs/moderation-history";
import { DangerZoneTab } from "@/components/overlays/board-settings/tabs/danger-zone";
import { SettingsSidebar } from "@/components/overlays/board-settings/sidebar";
import { useBoardData } from "@/hooks/use-board-data";

interface BoardSettingsOverlayProps {
  boardId: string;
  currentProfileId?: string;
  onClose: () => void;
}

export const BoardSettingsOverlay = ({
  boardId,
  currentProfileId,
  onClose,
}: BoardSettingsOverlayProps) => {
  const [tab, setTab] = useState<
    "general" | "members" | "bans" | "history" | "danger"
  >("general");
  const {
    data: board,
    isLoading,
    isFetching,
    isError,
  } = useBoardData(boardId, { enableFetch: true });
  const overlayShellShadow =
    "shadow-[0_18px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08),inset_1px_0_0_rgba(255,255,255,0.06),inset_-1px_0_0_rgba(0,0,0,0.42),inset_0_-1px_0_rgba(0,0,0,0.42)]";
  const currentMember = board?.members.find(
    (member) => member.profile.id === currentProfileId,
  );
  const currentRole = currentMember?.role;
  const canViewGeneral = currentRole === "OWNER" || currentRole === "ADMIN";
  const canViewMembers =
    currentRole === "OWNER" ||
    currentRole === "ADMIN" ||
    currentRole === "MODERATOR";
  const canViewBans = currentRole === "OWNER" || currentRole === "ADMIN";
  const canViewHistory = currentRole === "OWNER" || currentRole === "ADMIN";
  const canSeeDangerZone = currentMember?.role === "OWNER";

  useEffect(() => {
    if (isError || (!isLoading && !isFetching && !board)) {
      onClose();
    }
  }, [board, isError, isFetching, isLoading, onClose]);

  useEffect(() => {
    if (!board || !currentProfileId) return;

    if (!currentMember || currentMember.role === "GUEST") {
      onClose();
    }
  }, [board, currentMember, currentProfileId, onClose]);

  useEffect(() => {
    if (tab === "danger" && !canSeeDangerZone) {
      setTab(canViewMembers ? "members" : "general");
    } else if (tab === "bans" && !canViewBans) {
      setTab(canViewMembers ? "members" : "general");
    } else if (tab === "history" && !canViewHistory) {
      setTab(canViewMembers ? "members" : "general");
    } else if (tab === "general" && !canViewGeneral) {
      setTab(canViewMembers ? "members" : "general");
    } else if (tab === "members" && !canViewMembers) {
      setTab("general");
    }
  }, [
    canSeeDangerZone,
    canViewBans,
    canViewGeneral,
    canViewHistory,
    canViewMembers,
    tab,
  ]);

  if (typeof document === "undefined") {
    return null;
  }

  const isBoardPending = !board && (isLoading || isFetching);

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-6 overflow-y-auto overscroll-contain pointer-events-auto">
      <div
        className={cn(
          "relative flex h-[calc(100dvh-1rem)] w-full max-w-4xl flex-col overflow-hidden border border-theme-border bg-theme-bg-overlay-primary sm:h-[calc(100dvh-3rem)] sm:flex-row",
          "animate-in fade-in zoom-in duration-150",
          overlayShellShadow,
        )}
      >
        {/* SIDEBAR */}
        <SettingsSidebar
          tab={tab}
          setTab={setTab}
          onClose={onClose}
          showGeneralTab={canViewGeneral}
          showMembersTab={canViewMembers}
          showBansTab={canViewBans}
          showHistoryTab={canViewHistory}
          showDangerTab={canSeeDangerZone}
        />

        {/* MAIN PANEL */}
        <div className="scrollbar-navigation flex-1 overflow-y-auto border-t border-theme-border bg-theme-bg-quaternary/35 p-4 sm:border-t-0 sm:border-l sm:p-6">
          {isBoardPending && (
            <div className="flex h-full min-h-[320px] items-center justify-center">
              <div className="flex items-center gap-3 text-theme-text-tertiary">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading board settings...</span>
              </div>
            </div>
          )}

          {board && tab === "general" && canViewGeneral && (
            <GeneralTab board={board} />
          )}
          {board && tab === "members" && canViewMembers && (
            <MembersTab board={board} currentProfileId={currentProfileId} />
          )}
          {board && tab === "bans" && canViewBans && (
            <BansTab boardId={board.id} />
          )}
          {board && tab === "history" && canViewHistory && (
            <ModerationHistoryTab boardId={board.id} />
          )}
          {board && tab === "danger" && canSeeDangerZone && (
            <DangerZoneTab board={board} />
          )}
        </div>

        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          className="absolute right-2 top-2 cursor-pointer text-theme-text-subtle transition hover:text-theme-text-light"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>,
    document.body,
  );
};
