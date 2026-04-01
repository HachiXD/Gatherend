"use client";

import { memo } from "react";
import { Crown, Ghost, HardHat } from "lucide-react";
import { useCommunityHeaderStyle } from "@/hooks/use-community-header-style";
import { useBoardData } from "@/hooks/use-board-data";
import { useCurrentBoardId } from "@/contexts/board-switch-context";
import { MemberRole } from "@prisma/client";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const roleIconMap: Record<MemberRole, React.ReactNode> = {
  GUEST: null,
  MODERATOR: <Ghost className="ml-2 h-4 w-4 text-indigo-500" />,
  ADMIN: <HardHat className="h-4 w-4 text-rose-500" />,
  OWNER: <Crown className="ml-2 h-4 w-4 text-[#FFD700]" />,
};

const ROLE_HIERARCHY: Record<MemberRole, number> = {
  OWNER: 0,
  ADMIN: 1,
  MODERATOR: 2,
  GUEST: 3,
};

const MEMBER_ROW_CLASS =
  "flex min-h-10 items-center gap-3 rounded-none border border-theme-border-subtle bg-theme-bg-edit-form/50 px-3 py-1";

// ─── MembersView inner ────────────────────────────────────────────────────────

function MembersViewInner() {
  const boardId = useCurrentBoardId();
  const {
    data: board,
    isLoading: boardLoading,
    error: boardError,
  } = useBoardData(boardId, { enableFetch: true });

  const headerButtonStyles = useCommunityHeaderStyle(
    board?.imageAsset?.dominantColor ?? null,
  );

  const sortedMembers = board?.members
    ? [...board.members].sort(
        (a, b) => ROLE_HIERARCHY[a.role] - ROLE_HIERARCHY[b.role],
      )
    : [];

  if (!board && boardLoading) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden bg-theme-bg-tertiary">
        <div className="h-12 w-full shrink-0 animate-pulse bg-theme-bg-secondary/70" />
        <div className="flex-1 space-y-2 px-6 py-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-10 w-full animate-pulse rounded bg-theme-bg-secondary/70"
            />
          ))}
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
      <div className="h-full w-full overflow-y-auto scrollbar-chat">
        {/* Header */}
        <div className="sticky top-0 z-20 shrink-0 border-b border-theme-border transition-colors duration-300">
          <div className="px-0 pt-2.5 pb-2.5" style={headerButtonStyles}>
            <div className="ml-3 mr-3 flex items-center gap-2">
              <div className="flex min-w-0 max-w-[min(52vw,420px)] items-center justify-center gap-2 bg-(--community-header-btn-bg) px-3 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_-1px_0_0_rgba(255,255,255,0.16),inset_1px_0_0_rgba(0,0,0,0.38),inset_0_-1px_0_rgba(0,0,0,0.38)]">
                <p className="min-w-0 truncate text-center text-[16px] font-semibold text-theme-text-subtle">
                  {board ? `Miembros de ${board.name}` : "Miembros"}
                </p>
              </div>
              <span className="ml-1 shrink-0 text-[13px] text-(--community-header-btn-muted)">
                {sortedMembers.length}{" "}
                {sortedMembers.length === 1 ? "miembro" : "miembros"}
              </span>
            </div>
          </div>
        </div>

        {/* Members list */}
        <div className="px-4 py-4">
          <div className="space-y-2">
            {sortedMembers.map((member) => (
              <div key={member.id} className={cn(MEMBER_ROW_CLASS, "gap-2")}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <UserAvatar
                    src={member.profile.avatarAsset?.url ?? ""}
                    profileId={member.profile.id}
                    showStatus={false}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-0 text-sm font-semibold text-theme-text-primary">
                      <span className="truncate">
                        {member.profile.username}
                      </span>
                      {roleIconMap[member.role]}
                    </div>
                    <p className="truncate text-[11px] text-theme-text-tertiary">
                      /{member.profile.discriminator}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const MembersView = memo(MembersViewInner);
