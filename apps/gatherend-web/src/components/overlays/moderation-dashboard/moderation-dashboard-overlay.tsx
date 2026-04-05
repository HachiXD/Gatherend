"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

import { ModerationSidebar, ModerationTab } from "./sidebar";
import { ReportsTab } from "./tabs/reports";
import { HistoryTab } from "./tabs/history";
import { BannedUsersTab } from "./tabs/banned-users";
import { UserLookupTab } from "./tabs/user-lookup";
import { StatsTab } from "./tabs/stats";
import { BoardLookupTab } from "./tabs/board-lookup";
import { PendingInvestigationsTab } from "./tabs/pending-investigations";

interface ModerationDashboardOverlayProps {
  onClose: () => void;
}

export const ModerationDashboardOverlay = ({
  onClose,
}: ModerationDashboardOverlayProps) => {
  const [tab, setTab] = useState<ModerationTab>("reports");
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [selectedInvestigationId, setSelectedInvestigationId] = useState<string | null>(
    null,
  );

  const openBoardLookup = (boardId: string) => {
    setSelectedBoardId(boardId);
    setTab("board-lookup");
  };

  const openInvestigation = (investigationId: string) => {
    setSelectedInvestigationId(investigationId);
    setTab("pending-investigations");
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/40 p-2 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div
        className={cn(
          "relative flex h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden border border-theme-border bg-theme-bg-overlay-primary sm:h-[calc(100dvh-3rem)] sm:flex-row",
          "animate-in fade-in zoom-in duration-150 shadow-[0_18px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08),inset_1px_0_0_rgba(255,255,255,0.06),inset_-1px_0_0_rgba(0,0,0,0.42),inset_0_-1px_0_rgba(0,0,0,0.42)]",
        )}
      >
        <ModerationSidebar tab={tab} setTab={setTab} />

        <div className="scrollbar-navigation flex-1 overflow-y-auto border-t border-theme-border bg-theme-bg-quaternary/35 p-4 sm:border-l sm:border-t-0 sm:p-6">
          {tab === "reports" && (
            <ReportsTab
              onViewBoard={openBoardLookup}
              onViewInvestigation={openInvestigation}
            />
          )}
          {tab === "history" && <HistoryTab />}
          {tab === "banned-users" && <BannedUsersTab />}
          {tab === "user-lookup" && <UserLookupTab />}
          {tab === "board-lookup" && (
            <BoardLookupTab initialBoardId={selectedBoardId} />
          )}
          {tab === "pending-investigations" && (
            <PendingInvestigationsTab
              initialInvestigationId={selectedInvestigationId}
              onViewBoard={openBoardLookup}
            />
          )}
          {tab === "stats" && <StatsTab />}
        </div>

        <button
          onClick={onClose}
          className="absolute right-2 top-2 cursor-pointer text-theme-text-subtle transition hover:text-theme-text-light"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
