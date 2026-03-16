"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import type { CommunityOption } from "@/hooks/use-communities-list";

interface CommunitySelectCardProps {
  community: CommunityOption;
  isSelected: boolean;
  onClick: () => void;
}

export function CommunitySelectCard({
  community,
  isSelected,
  onClick,
}: CommunitySelectCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 p-2 rounded-md transition-colors text-left",
        "hover:bg-theme-bg-tertiary",
        isSelected
          ? "bg-theme-accent-primary/20 border border-theme-accent-primary"
          : "bg-theme-bg-secondary border border-transparent"
      )}
    >
      <div className="relative w-8 h-8 rounded-md overflow-hidden shrink-0 bg-theme-bg-tertiary">
        {community.imageAsset?.url ? (
          <Image
            src={community.imageAsset.url}
            alt={community.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-theme-text-muted">
            {community.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            "text-sm font-medium truncate",
            isSelected ? "text-theme-text-light" : "text-theme-text-subtle"
          )}
        >
          {community.name}
        </div>
        <div className="text-[11px] text-theme-text-muted">
          {community.memberCount} miembro
          {community.memberCount === 1 ? "" : "s"}
        </div>
      </div>
    </button>
  );
}
