"use client";

import {
  memo,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Plus, Settings } from "lucide-react";
import {
  useBoardSwitchNavigation,
  useCurrentBoardId,
  useCurrentCommunitySection,
} from "@/contexts/board-switch-context";
import { useCommunityOverview } from "@/hooks/discovery/use-community-overview";
import { useModal } from "@/hooks/use-modal-store";
import { CommunityBoardsSection } from "./community-boards-section";
import { CommunityPostsSection } from "./community-posts-section";
import { CommunityViewShell } from "./community-view-shell";
import { useBoardNavigationStore } from "@/stores/board-navigation-store";
import { useEffect } from "react";

interface CommunityViewProps {
  communityId: string;
}

function CommunityViewInner({ communityId }: CommunityViewProps) {
  const activeSection = useCurrentCommunitySection();
  const currentBoardId = useCurrentBoardId();
  const [isBackPending, startBackTransition] = useTransition();
  const {
    switchToCommunityBoards,
    switchToCommunityPosts,
    switchToDiscovery,
    isClientNavigationEnabled,
  } =
    useBoardSwitchNavigation();
  const { community, isLoading, error } = useCommunityOverview(communityId);
  const { onOpen } = useModal();
  const [sectionHeaderAction, setSectionHeaderAction] = useState<ReactNode>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const boardsPersistScrollRef = useRef<(() => void) | null>(null);
  const postsPersistScrollRef = useRef<(() => void) | null>(null);

  const handleSelectSection = useCallback(
    (section: "boards" | "posts") => {
      if (activeSection === "boards") {
        boardsPersistScrollRef.current?.();
      } else {
        postsPersistScrollRef.current?.();
      }

      if (section === "boards") {
        switchToCommunityBoards(communityId);
        return;
      }

      switchToCommunityPosts(communityId);
    },
    [activeSection, communityId, switchToCommunityBoards, switchToCommunityPosts],
  );

  const persistActiveDiscoveryScroll = useCallback(() => {
    if (activeSection === "boards") {
      boardsPersistScrollRef.current?.();
      return;
    }

    postsPersistScrollRef.current?.();
  }, [activeSection]);

  useEffect(() => {
    useBoardNavigationStore
      .getState()
      .registerActiveDiscoveryScrollPersistence(persistActiveDiscoveryScroll);

    return () => {
      useBoardNavigationStore
        .getState()
        .registerActiveDiscoveryScrollPersistence(null);
    };
  }, [persistActiveDiscoveryScroll]);

  const handleBackToDiscovery = useCallback(() => {
    startBackTransition(() => {
      if (isClientNavigationEnabled) {
        switchToDiscovery();
        return;
      }

      const boardId =
        currentBoardId || useBoardNavigationStore.getState().currentBoardId;
      window.location.href = `/boards/${boardId}/discovery`;
    });
  }, [currentBoardId, isClientNavigationEnabled, switchToDiscovery]);

  const handleCreate = useCallback(() => {
    if (activeSection === "boards") {
      onOpen("createBoard");
      return;
    }

    onOpen("createCommunityPost", {
      communityId,
      communityName: community?.name,
    });
  }, [activeSection, community?.name, communityId, onOpen]);

  const headerLeading = useMemo(
    () => (
      <Button
        type="button"
        variant="ghost"
        onClick={handleBackToDiscovery}
        disabled={isBackPending}
        className="h-9 w-9 cursor-pointer rounded-none border-0 bg-[var(--community-header-btn-bg)] p-0 text-[var(--community-header-btn-text)] hover:bg-[var(--community-header-btn-hover)] hover:text-[var(--community-header-btn-text)] focus-visible:ring-2 focus-visible:ring-[var(--community-header-btn-ring)]"
        aria-label="Back to discovery"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
    ),
    [handleBackToDiscovery, isBackPending],
  );

  const headerAction = useMemo(
    () => (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCreate}
          className="inline-flex h-9 cursor-pointer items-center gap-2 border-0 bg-[var(--community-header-btn-bg)] px-3 text-[13px] font-semibold text-[var(--community-header-btn-text)] hover:bg-[var(--community-header-btn-hover)] focus-visible:ring-2 focus-visible:ring-[var(--community-header-btn-ring)] focus-visible:outline-none disabled:opacity-50 rounded-none"
        >
          <Plus className="h-4 w-4" />
          {activeSection === "boards" ? "Crear board" : "Crear post"}
        </button>
        {sectionHeaderAction}
        {community?.canDeleteAnyPost && (
          <button
            type="button"
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center border-0 bg-[var(--community-header-btn-bg)] text-[var(--community-header-btn-text)] hover:bg-[var(--community-header-btn-hover)] hover:text-[var(--community-header-btn-text)] focus-visible:ring-2 focus-visible:ring-[var(--community-header-btn-ring)] focus-visible:outline-none rounded-none"
            title="Ajustes de comunidad (pendiente)"
            aria-label="Ajustes de comunidad"
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
      </div>
    ),
    [activeSection, community?.canDeleteAnyPost, handleCreate, sectionHeaderAction],
  );

  if (!community && isLoading) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden bg-theme-bg-tertiary">
        <Skeleton className="h-40 w-full shrink-0 rounded-none bg-theme-bg-secondary/70" />
        <div className="border-b border-theme-border px-6 py-4">
          <Skeleton className="h-8 w-56 bg-theme-bg-secondary/70" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full bg-theme-bg-secondary/70" />
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-8 w-20 bg-theme-bg-secondary/70" />
            <Skeleton className="h-8 w-20 bg-theme-bg-secondary/70" />
          </div>
        </div>
        <div className="flex-1 space-y-4 px-6 py-4">
          <Skeleton className="h-32 w-full bg-theme-bg-secondary/70" />
          <Skeleton className="h-32 w-full bg-theme-bg-secondary/70" />
          <Skeleton className="h-32 w-full bg-theme-bg-secondary/70" />
        </div>
      </div>
    );
  }

  if (!community && error) {
    return (
      <div className="flex h-full w-full items-center justify-center px-6 text-center text-destructive">
        Error: {error}
      </div>
    );
  }

  return (
    <CommunityViewShell
      community={community}
      activeSection={activeSection}
      onSelectSection={handleSelectSection}
      headerLeading={headerLeading}
      headerAction={headerAction}
      scrollContainerRef={scrollContainerRef}
    >
      <div className={activeSection === "boards" ? "block" : "hidden"}>
        <CommunityBoardsSection
          communityId={communityId}
          isActive={activeSection === "boards"}
          onHeaderActionChange={setSectionHeaderAction}
          onPersistScrollReady={(persist) => {
            boardsPersistScrollRef.current = persist;
          }}
          scrollContainerRef={scrollContainerRef}
        />
      </div>
      <div className={activeSection === "posts" ? "block" : "hidden"}>
        <CommunityPostsSection
          communityId={communityId}
          isActive={activeSection === "posts"}
          onHeaderActionChange={setSectionHeaderAction}
          onPersistScrollReady={(persist) => {
            postsPersistScrollRef.current = persist;
          }}
          scrollContainerRef={scrollContainerRef}
        />
      </div>
    </CommunityViewShell>
  );
}

export const CommunityView = memo(CommunityViewInner);
