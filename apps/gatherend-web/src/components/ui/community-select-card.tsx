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
        "flex w-full items-center gap-2 border px-2 py-1.5 text-left transition",
        "border-theme-border cursor-pointer bg-theme-bg-secondary/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_-1px_0_0_rgba(0,0,0,0.28),inset_0_-1px_0_rgba(0,0,0,0.28)] hover:bg-theme-bg-tertiary/40",
        isSelected
          ? "border-theme-border-accent-active-channel bg-theme-bg-secondary/40 text-theme-text-light"
          : "text-theme-text-subtle",
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
          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-theme-text-muted">
            {community.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            "text-sm font-medium truncate",
            isSelected ? "text-theme-text-light" : "text-theme-text-subtle",
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
