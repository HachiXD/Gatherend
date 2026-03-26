"use client";

import { useState, useMemo } from "react";
import { X, Search, Users, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMyCommunities, type MyCommunity } from "@/hooks/use-my-communities";
import { useTranslation } from "@/i18n";
import { CreateCommunityDialog } from "@/components/modals/create-community-modal";

interface MyCommunitiesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const sectionLabelClass =
  "block uppercase text-xs font-bold text-theme-text-subtle";
const panelSectionClass =
  "space-y-2 border border-theme-border-subtle bg-theme-bg-edit-form/30 px-3 py-2";
const fieldInputClass =
  "h-8 rounded-none border border-theme-border-subtle bg-theme-bg-edit-form/50 pl-8 pr-3 text-[14px] text-theme-text-primary placeholder:text-theme-text-muted focus-visible:border-theme-border-subtle focus-visible:ring-0 focus-visible:ring-offset-0";

// Skeleton for community list loading
function CommunityListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2 border border-theme-border bg-theme-bg-secondary/20 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_-1px_0_0_rgba(0,0,0,0.28),inset_0_-1px_0_rgba(0,0,0,0.28)] animate-pulse"
        >
          <div className="h-8 w-8 border border-theme-border bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-white/10 w-3/4" />
            <div className="h-2.5 bg-white/10 w-1/2" />
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
        "flex items-center gap-2 border px-2 py-1.5 text-left transition",
        "border-theme-border bg-theme-bg-secondary/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_-1px_0_0_rgba(0,0,0,0.28),inset_0_-1px_0_rgba(0,0,0,0.28)] hover:bg-theme-bg-tertiary/40",
      )}
    >
      <div className="relative h-8 w-8 shrink-0 overflow-hidden border border-theme-border bg-theme-bg-tertiary">
        {community.imageAsset?.url ? (
          <Image
            src={community.imageAsset.url}
            alt={community.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-theme-text-muted">
            {community.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-theme-text-light">
          {community.name}
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
  const [isCreateCommunityOpen, setIsCreateCommunityOpen] = useState(false);

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
      className="fixed top-16 right-4 z-50 w-[356px] overflow-hidden border border-theme-border bg-theme-bg-dropdown-menu-primary text-theme-text-subtle shadow-xl animate-in fade-in slide-in-from-top-2 duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex h-8 items-center justify-between border-b border-theme-border bg-theme-bg-secondary/40 px-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-theme-text-muted" />
          <h3 className="text-[15px] font-bold tracking-[0.04em] text-theme-text-light">
            {t.modals.myCommunities.title}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="cursor-pointer rounded-none p-1 text-theme-text-subtle opacity-100 transition hover:text-theme-text-light data-[state=open]:bg-transparent data-[state=open]:text-theme-text-subtle focus:ring-0 focus:ring-offset-0 focus:outline-none"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Search */}
      <div className="scrollbar-ultra-thin max-h-[70vh] space-y-3 overflow-y-auto px-4 py-3">
        {/* Nueva comunidad */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6.5 w-full cursor-pointer rounded-none border-theme-border-subtle bg-theme-bg-cancel-button text-[12px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
          onClick={() => setIsCreateCommunityOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Nueva comunidad
        </Button>

        <div className={panelSectionClass}>
          <label htmlFor="my-communities-search" className={sectionLabelClass}>
            {t.modals.myCommunities.searchPlaceholder}
          </label>
          <div className="relative -mt-0.5">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-text-muted" />
            <Input
              id="my-communities-search"
              name="my-communities-search"
              type="text"
              placeholder={t.modals.myCommunities.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={fieldInputClass}
            />
          </div>
        </div>

        {/* Content */}
        <div className={cn(panelSectionClass, "space-y-2.5")}>
          <div className="border-b border-theme-border-subtle pb-1">
            <span className={sectionLabelClass}>
              {t.modals.myCommunities.title}
            </span>
          </div>
          {isLoading ? (
            <CommunityListSkeleton />
          ) : filteredCommunities.length === 0 ? (
            <div className="border border-theme-border-subtle bg-theme-bg-edit-form/35 px-3 py-6 text-center text-sm text-theme-text-muted">
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
      </div>

      {/* Footer - Stats */}
      {!isLoading && communities.length > 0 && (
        <div className="border-t border-theme-border bg-theme-bg-secondary/40 px-4 py-1.5">
          <p className="text-center text-xs text-theme-text-muted">
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

      <CreateCommunityDialog
        isOpen={isCreateCommunityOpen}
        onClose={() => setIsCreateCommunityOpen(false)}
        stackAbove
      />
    </div>
  );
}
