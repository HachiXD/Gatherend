"use client";

import { useState, useMemo } from "react";
import { X, Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useMyCommunities, type MyCommunity } from "@/hooks/use-my-communities";
import { useTranslation } from "@/i18n";

interface MyCommunitiesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Skeleton for community list loading
function CommunityListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-md bg-theme-bg-secondary animate-pulse"
        >
          <div className="w-10 h-10 rounded-md bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-white/10 rounded w-3/4" />
            <div className="h-3 bg-white/10 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Community card component
function CommunityCard({ community }: { community: MyCommunity }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-md transition-colors",
        "bg-theme-bg-secondary hover:bg-theme-bg-tertiary",
      )}
    >
      <div className="relative w-10 h-10 rounded-md overflow-hidden shrink-0 bg-theme-bg-tertiary">
        {community.imageAsset?.url ? (
          <Image
            src={community.imageAsset.url}
            alt={community.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm font-bold text-theme-text-muted">
            {community.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-theme-text-light truncate">
          {community.name}
        </div>
        <div className="text-xs text-theme-text-muted">
          {community.boardCount} / {community.totalBoardCount}{" "}
          {community.totalBoardCount === 1 ? "board" : "boards"}
        </div>
      </div>
    </div>
  );
}

export function MyCommunitiesModal({
  isOpen,
  onClose,
}: MyCommunitiesModalProps) {
  const { t } = useTranslation();
  const { communities, isLoading } = useMyCommunities();
  const [search, setSearch] = useState("");

  // Filtrar communities por búsqueda
  const filteredCommunities = useMemo(() => {
    if (!search.trim()) return communities;
    const searchLower = search.toLowerCase();
    return communities.filter((c) =>
      c.name.toLowerCase().includes(searchLower),
    );
  }, [communities, search]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed top-16 right-4 z-50 w-80 bg-theme-bg-dropdown-menu-primary border border-theme-border-secondary rounded-lg shadow-xl animate-in fade-in slide-in-from-top-2 duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-theme-border-secondary">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-theme-text-muted" />
          <h3 className="text-sm font-semibold text-theme-text-light">
            {t.modals.myCommunities.title}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-theme-bg-tertiary transition-colors"
        >
          <X className="w-4 h-4 text-theme-text-muted" />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-theme-border-secondary">
        <div className="relative">
          <label htmlFor="my-communities-search" className="sr-only">
            {t.modals.myCommunities.searchPlaceholder}
          </label>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-text-muted" />
          <input
            id="my-communities-search"
            name="my-communities-search"
            type="text"
            placeholder={t.modals.myCommunities.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full pl-9 pr-3 py-2 text-sm rounded-md",
              "bg-theme-bg-input border border-theme-border-secondary",
              "text-theme-text-light placeholder:text-theme-text-muted",
              "focus:outline-none focus:ring-1 focus:ring-theme-accent-primary",
            )}
          />
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-h-[60vh] overflow-y-auto">
        {isLoading ? (
          <CommunityListSkeleton />
        ) : filteredCommunities.length === 0 ? (
          <div className="text-center py-8 text-sm text-theme-text-muted">
            {search
              ? t.modals.myCommunities.noResults
              : t.modals.myCommunities.noCommunities}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCommunities.map((community) => (
              <CommunityCard key={community.id} community={community} />
            ))}
          </div>
        )}
      </div>

      {/* Footer - Stats */}
      {!isLoading && communities.length > 0 && (
        <div className="px-4 py-3 border-t border-theme-border-secondary">
          <p className="text-xs text-theme-text-muted text-center">
            {t.modals.myCommunities.memberOf.replace(
              "{count}",
              String(communities.length),
            )}{" "}
            {communities.length === 1
              ? t.modals.myCommunities.community
              : t.modals.myCommunities.communities}
          </p>
        </div>
      )}
    </div>
  );
}
