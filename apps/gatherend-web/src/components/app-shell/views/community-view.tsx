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
import { ChevronLeft, Plus, Settings, UserCheck, UserPlus } from "lucide-react";
import {
  useBoardSwitchNavigation,
  useCurrentBoardId,
  useCurrentCommunitySection,
} from "@/contexts/board-switch-context";
import {
  useCommunityOverview,
  communityOverviewKey,
} from "@/hooks/discovery/use-community-overview";
import { useModal } from "@/hooks/use-modal-store";
import { CommunityBoardsSection } from "./community-boards-section";
import { CommunityPostsSection } from "./community-posts-section";
import { CommunityViewShell } from "./community-view-shell";
import { InlineCommunityPostForm } from "./inline-community-post-form";
import { useBoardNavigationStore } from "@/stores/board-navigation-store";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { MyCommunity } from "@/hooks/use-my-communities";

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
  } = useBoardSwitchNavigation();
  const { community, isLoading, isFetchingMembership, error } =
    useCommunityOverview(communityId);
  const queryClient = useQueryClient();
  const { onOpen } = useModal();
  const [sectionHeaderAction, setSectionHeaderAction] =
    useState<ReactNode>(null);
  const [isJoinLeaveLoading, setIsJoinLeaveLoading] = useState(false);
  const [showPostForm, setShowPostForm] = useState(false);
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

      setShowPostForm(false);

      if (section === "boards") {
        switchToCommunityBoards(communityId);
        return;
      }

      switchToCommunityPosts(communityId);
    },
    [
      activeSection,
      communityId,
      switchToCommunityBoards,
      switchToCommunityPosts,
    ],
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

  const handleJoinLeave = useCallback(async () => {
    if (!community || isJoinLeaveLoading) return;
    const isMember = community.isMember;
    setIsJoinLeaveLoading(true);
    try {
      const endpoint = isMember
        ? `/api/communities/${communityId}/leave`
        : `/api/communities/${communityId}/join`;
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) throw new Error("Request failed");
      queryClient.setQueryData(
        communityOverviewKey(communityId),
        (old: typeof community | undefined) =>
          old ? { ...old, isMember: !isMember } : old,
      );
      queryClient.setQueryData<MyCommunity[]>(["my-communities"], (old) => {
        if (!old) return old;
        if (isMember) {
          return old.filter((c) => c.id !== communityId);
        } else {
          if (old.some((c) => c.id === communityId)) return old;
          const newEntry: MyCommunity = {
            id: community.id,
            name: community.name,
            imageAsset: community.imageAsset,
          };
          return [...old, newEntry].sort((a, b) =>
            a.name.localeCompare(b.name),
          );
        }
      });
    } catch {
      // no-op, state reverts naturally on next refetch
    } finally {
      setIsJoinLeaveLoading(false);
    }
  }, [community, communityId, isJoinLeaveLoading, queryClient]);

  const bannerAction = useMemo(() => {
    if (!community && !isFetchingMembership) return null;
    const showLoading = isJoinLeaveLoading || isFetchingMembership;
    return (
      <button
        type="button"
        onClick={handleJoinLeave}
        disabled={showLoading}
        className="inline-flex cursor-pointer items-center gap-1.5 border border-white/25 bg-black/40 px-3 h-8 text-[13px] font-semibold text-white backdrop-blur-sm hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-60 "
      >
        {showLoading ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Cargando...
          </>
        ) : community?.isMember ? (
          <>
            <UserCheck className="h-3.5 w-3.5" />
            Dejar de seguir comunidad
          </>
        ) : (
          <>
            <UserPlus className="h-3.5 w-3.5" />
            Unirse como miembro
          </>
        )}
      </button>
    );
  }, [community, handleJoinLeave, isFetchingMembership, isJoinLeaveLoading]);

  const handleCreate = useCallback(() => {
    if (activeSection === "boards") {
      onOpen("createBoard");
      return;
    }

    setShowPostForm((v) => !v);
  }, [activeSection, onOpen]);

  const headerLeading = useMemo(
    () => (
      <Button
        type="button"
        variant="ghost"
        onClick={handleBackToDiscovery}
        disabled={isBackPending}
        className="h-8 w-8 cursor-pointer rounded-none border-0 bg-[var(--community-header-btn-bg)] p-0 text-[var(--community-header-btn-text)] hover:bg-[var(--community-header-btn-hover)] hover:text-[var(--community-header-btn-text)] focus-visible:ring-2 focus-visible:ring-[var(--community-header-btn-ring)]"
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
          className="inline-flex h-6.5 cursor-pointer items-center gap-2 border-0 bg-[var(--community-header-btn-bg)] px-3 text-[13px] font-semibold text-[var(--community-header-btn-text)] hover:bg-[var(--community-header-btn-hover)] focus-visible:ring-2 focus-visible:ring-[var(--community-header-btn-ring)] focus-visible:outline-none disabled:opacity-50 rounded-none"
        >
          <Plus className="h-4 w-4" />
          {activeSection === "boards" ? "Crear board" : "Crear post"}
        </button>
        {sectionHeaderAction}
        {community?.canDeleteAnyPost && (
          <button
            type="button"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center border-0 bg-[var(--community-header-btn-bg)] text-[var(--community-header-btn-text)] hover:bg-[var(--community-header-btn-hover)] hover:text-[var(--community-header-btn-text)] focus-visible:ring-2 focus-visible:ring-[var(--community-header-btn-ring)] focus-visible:outline-none rounded-none"
            title="Ajustes de comunidad (pendiente)"
            aria-label="Ajustes de comunidad"
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
      </div>
    ),
    [
      activeSection,
      community?.canDeleteAnyPost,
      handleCreate,
      sectionHeaderAction,
    ],
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
      bannerAction={bannerAction}
      belowHeader={
        showPostForm && activeSection === "posts" ? (
          <InlineCommunityPostForm
            communityId={communityId}
            communityName={community?.name}
            hasDominantColor={!!community?.imageAsset?.dominantColor}
            onCancel={() => setShowPostForm(false)}
            onSuccess={() => setShowPostForm(false)}
          />
        ) : undefined
      }
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
