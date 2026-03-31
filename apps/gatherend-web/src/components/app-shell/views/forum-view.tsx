"use client";

import {
  memo,
  type CSSProperties,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { Plus, RefreshCw } from "lucide-react";
import { useColorExtraction } from "@/hooks/use-color-extraction";
import { getNeverAnimatedImageUrl } from "@/lib/media-static";
import { useBoardData, useCurrentMemberRole } from "@/hooks/use-board-data";
import { useProfile } from "@/components/app-shell/providers/profile-provider";
import { useCurrentBoardId } from "@/contexts/board-switch-context";
import { MemberRole } from "@prisma/client";
import { CommunityPostsSection } from "./community-posts-section";
import { InlineCommunityPostForm } from "./inline-community-post-form";

function parseRgbColor(color: string): [number, number, number] | null {
  const m =
    color.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i) ??
    color.match(
      /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*[0-9.]+\s*\)$/i,
    );
  if (!m) return null;
  return m.slice(1, 4).map(Number) as [number, number, number];
}

function isVeryDarkColor(color: string): boolean {
  const rgb = parseRgbColor(color);
  if (!rgb) return false;
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  return l <= 0.24;
}

function ForumViewInner() {
  const boardId = useCurrentBoardId();
  const {
    data: board,
    isLoading,
    error: boardError,
    refetch,
  } = useBoardData(boardId, { enableFetch: true });
  const profile = useProfile();
  const role = useCurrentMemberRole(profile.id);
  const _canDeleteAnyPost =
    role === MemberRole.OWNER ||
    role === MemberRole.ADMIN ||
    role === MemberRole.MODERATOR;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showPostForm, setShowPostForm] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const bannerImageUrl = board?.imageAsset?.url
    ? getNeverAnimatedImageUrl(board.imageAsset.url, { w: 2048, h: 512, q: 82 })
    : undefined;

  const precomputedColor = board?.imageAsset?.dominantColor ?? null;
  const { dominantColor: extractedColor, handleImageLoad: _handleImageLoad } =
    useColorExtraction({
      imageUrl: precomputedColor ? null : bannerImageUrl,
    });
  const dominantColor = precomputedColor ?? extractedColor;
  const headerBg = dominantColor ?? "var(--theme-bg-secondary)";
  const useLightVariant = isVeryDarkColor(headerBg);

  const headerButtonStyles = useMemo(
    () =>
      ({
        backgroundColor: headerBg,
        "--community-header-btn-bg": useLightVariant
          ? `color-mix(in srgb, ${headerBg} 82%, white)`
          : `color-mix(in srgb, ${headerBg} 72%, black)`,
        "--community-header-btn-hover": useLightVariant
          ? `color-mix(in srgb, ${headerBg} 68%, white)`
          : `color-mix(in srgb, ${headerBg} 58%, black)`,
        "--community-header-btn-text": `color-mix(in srgb, white 88%, ${headerBg} 12%)`,
        "--community-header-btn-muted": `color-mix(in srgb, white 68%, ${headerBg} 32%)`,
        "--community-header-btn-ring": `color-mix(in srgb, white 28%, ${headerBg} 72%)`,
      }) as CSSProperties,
    [headerBg, useLightVariant],
  );

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refetch]);

  const handleCreate = useCallback(() => {
    setShowPostForm((v) => !v);
  }, []);

  if (!board && isLoading) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden bg-theme-bg-tertiary">
        <div className="h-12 w-full shrink-0 animate-pulse bg-theme-bg-secondary/70" />
        <div className="flex-1 space-y-4 px-6 py-4">
          <div className="h-32 w-full animate-pulse rounded bg-theme-bg-secondary/70" />
          <div className="h-32 w-full animate-pulse rounded bg-theme-bg-secondary/70" />
        </div>
      </div>
    );
  }

  if (!board && boardError) {
    return (
      <div className="flex h-full w-full items-center justify-center px-6 text-center text-destructive">
        {boardError.message}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-theme-bg-tertiary">
      <div
        ref={scrollContainerRef}
        className="h-full w-full overflow-y-auto scrollbar-chat"
      >
        <div className="sticky top-0 z-20 shrink-0 border-b border-theme-border transition-colors duration-300">
          <div className="px-0 pt-2 pb-2" style={headerButtonStyles}>
            <div className="ml-3 mr-3 flex items-center gap-2">
              {/* Badge estilo chat-header */}
              <div className="flex min-w-20 items-center justify-center gap-2 bg-(--community-header-btn-bg) px-3 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_-1px_0_0_rgba(255,255,255,0.16),inset_1px_0_0_rgba(0,0,0,0.38),inset_0_-1px_0_rgba(0,0,0,0.38)]">
                <p className="text-center text-[16px] font-semibold text-theme-text-subtle">
                  [Foro]
                </p>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCreate}
                  className="inline-flex  border border-theme-border  h-8 cursor-pointer items-center gap-2 bg-(--community-header-btn-bg) px-3 text-[14px] font-semibold text-(--community-header-btn-text) hover:bg-(--community-header-btn-hover) focus-visible:ring-2 focus-visible:ring-(--community-header-btn-ring) focus-visible:outline-none disabled:opacity-50 rounded-none"
                >
                  <Plus className="h-5 w-5" />
                  Crear post
                </button>

                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="inline-flex  border border-theme-border  h-8 cursor-pointer items-center gap-2 bg-(--community-header-btn-bg) px-3 text-[14px] font-semibold text-(--community-header-btn-text) hover:bg-(--community-header-btn-hover) focus-visible:ring-2 focus-visible:ring-(--community-header-btn-ring) focus-visible:outline-none disabled:opacity-50 rounded-none"
                  title="Refrescar posts"
                >
                  <RefreshCw
                    className={`h-5 w-5 text-(--community-header-btn-muted) ${isRefreshing ? "animate-spin" : ""}`}
                  />
                  <span className="text-(--community-header-btn-text)">
                    Refrescar
                  </span>
                </button>
              </div>
            </div>
          </div>
          {showPostForm && (
            <div style={headerButtonStyles} className="pb-2.5 px-3">
              <InlineCommunityPostForm
                communityId={boardId}
                communityName={board?.name}
                hasDominantColor={!!board?.imageAsset?.dominantColor}
                onCancel={() => setShowPostForm(false)}
                onSuccess={() => setShowPostForm(false)}
              />
            </div>
          )}
        </div>

        {/* Posts feed */}
        <div className="w-full">
          <CommunityPostsSection
            communityId={boardId}
            isActive={true}
            scrollContainerRef={scrollContainerRef}
          />
        </div>
      </div>
    </div>
  );
}

export const ForumView = memo(ForumViewInner);
