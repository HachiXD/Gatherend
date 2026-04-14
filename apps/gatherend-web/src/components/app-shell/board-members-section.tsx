"use client";

import { Crown, Ghost, HardHat, Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { UserAvatar } from "@/components/user-avatar";
import { MemberRole } from "@prisma/client";
import {
  getGradientAnimationClass,
  getUsernameColorStyle,
} from "@/lib/username-color";
import { cn } from "@/lib/utils";
import { useBoardMembers } from "@/hooks/use-board-members";
import { useProfile } from "@/components/app-shell/providers/profile-provider";
import { UserAvatarMenu } from "@/components/user-avatar-menu";

export function MembersSkeleton() {
  return (
    <div className="px-3 pt-2 flex min-h-0 flex-1 flex-col">
      <div className="mb-3 h-3 w-20 rounded bg-theme-bg-tertiary animate-pulse" />
      <div className="space-y-1 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 px-2 py-1">
            <div className="h-7 w-7 rounded-full bg-theme-bg-tertiary animate-pulse shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="h-2.5 w-20 rounded bg-theme-bg-tertiary animate-pulse" />
              <div className="h-2 w-12 rounded bg-theme-bg-tertiary animate-pulse" />
            </div>
            <div className="h-6 w-6 rounded bg-theme-bg-tertiary animate-pulse shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

const roleIconMap: Record<MemberRole, React.ReactNode> = {
  GUEST: null,
  MODERATOR: <Ghost className="h-3.5 w-3.5 text-indigo-400" />,
  ADMIN: <HardHat className="h-3.5 w-3.5 text-rose-400" />,
  OWNER: <Crown className="h-3.5 w-3.5 text-[#FFD700]" />,
};

interface BoardMembersSectionProps {
  boardId: string;
  boardName: string;
}

export function BoardMembersSection({
  boardId,
  boardName,
}: BoardMembersSectionProps) {
  const { resolvedTheme } = useTheme();
  const currentProfile = useProfile();
  const {
    pageSlots,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    containerRef,
    bottomSentinelRef,
  } = useBoardMembers(boardId, {
    rowHeight: 28,
    maxRenderedPages: 4,
  });

  if (isLoading) {
    return <MembersSkeleton />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-3 pt-2 pb-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-[14px]  uppercase tracking-wide text-theme-text-tertiary">
            {`Miembros de ${boardName}`}
          </h2>
        </div>
      </div>

      <div
        ref={containerRef}
        className="scrollbar-navigation min-h-0 flex-1 overflow-y-auto px-1 pb-2"
      >
        <div className="space-y-0">
          {pageSlots.map((slot) =>
            slot.type === "virtualized" ? (
              <div
                key={`members-placeholder-${slot.pageIndex}`}
                style={{ height: slot.height }}
              />
            ) : (
              <div key={`members-page-${slot.pageIndex}`} className="space-y-0">
                {slot.page.items.map((member) => (
                  <div
                    key={member.id}
                    className="flex min-h-7 items-center gap-2 bg-transparent px-2 py-0"
                  >
                    <UserAvatar
                      src={member.profile.avatarAsset?.url ?? ""}
                      profileId={member.profile.id}
                      className="h-6 w-6"
                      showStatus
                      statusClassName="w-[40%] min-w-[10px] -mr-0.5 -mb-0.5 max-w-[10px]"
                    />
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <UserAvatarMenu
                          profileId={member.profile.id}
                          profileImageUrl={
                            member.profile.avatarAsset?.url ?? ""
                          }
                          username={member.profile.username}
                          currentProfileId={currentProfile.id}
                          currentProfile={currentProfile}
                          memberId={member.id}
                          memberRole={member.role}
                          usernameColor={member.profile.usernameColor}
                          usernameFormat={member.profile.usernameFormat}
                          hideAvatar
                          showStatus={false}
                        >
                          <p
                            className={cn(
                              "min-w-0 truncate text-[16px] font-medium leading-tight text-theme-text-primary cursor-pointer hover:underline",
                              getGradientAnimationClass(
                                member.profile.usernameColor,
                              ),
                            )}
                            style={getUsernameColorStyle(
                              member.profile.usernameColor,
                              {
                                isOwnProfile: false,
                                themeMode:
                                  (resolvedTheme as "dark" | "light") || "dark",
                              },
                            )}
                          >
                            {member.profile.username}
                          </p>
                        </UserAvatarMenu>
                      </div>
                      {roleIconMap[member.role] ? (
                        <div
                          className="flex h-5.5 w-5.5  rounded-sm shrink-0 items-center justify-center border border-[var(--community-header-btn-ring,var(--theme-border-secondary))] bg-[var(--community-header-btn-bg,var(--theme-chat-input-button-bg))] shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_-1px_0_0_rgba(255,255,255,0.16),inset_1px_0_0_rgba(0,0,0,0.38),inset_0_-1px_0_rgba(0,0,0,0.38)]"
                          title={member.role}
                        >
                          {roleIconMap[member.role]}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ),
          )}

          <div ref={bottomSentinelRef} className="h-1" />

          {hasNextPage ? (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="mt-1 flex h-7 w-full cursor-pointer items-center justify-center border border-theme-border-subtle text-xs text-theme-text-tertiary transition hover:text-theme-text-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isFetchingNextPage ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Cargar más"
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
