"use client";

import { UserAvatar } from "@/components/user-avatar";
import {
  Check,
  Crown,
  Gavel,
  Ghost,
  HardHat,
  Loader2,
  Minus,
  Plus,
  User,
  UserMinus,
} from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MemberRole } from "@prisma/client";
import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import type { BoardWithData } from "@/lib/boards/board-types";
import { boardQueryKey } from "@/lib/boards/board-query";
import { toast } from "sonner";
import { useBoardMembers } from "@/hooks/use-board-members";
import {
  patchBoardMemberInCache,
  removeBoardMemberFromCache,
} from "@/hooks/board-cache";
import { assignableBy, canKick, canBan, canWarn, outranks } from "@/lib/domain-client";

const roleIconMap = {
  GUEST: null,
  MODERATOR: <Ghost className="ml-2 h-4 w-4 text-indigo-500" />,
  ADMIN: <HardHat className="ml-2 h-4 w-4 text-rose-500" />,
  OWNER: <Crown className="ml-2 h-4 w-4 text-[#FFD700]" />,
};
const HEADER_PANEL_SHELL =
  "rounded-lg border border-theme-border bg-theme-bg-overlay-primary/78 px-4 mr-1.5 pt-4 pb-0 sm:px-5 sm:py-5";
const MEMBER_ROW_CLASS =
  "flex min-h-10 items-center gap-3 rounded-lg border border-theme-border-subtle bg-theme-bg-edit-form/50 px-3 py-1";
const actionButtonClass =
  "h-6.5 min-w-[120px] cursor-pointer rounded-lg bg-theme-tab-button-bg px-3 text-[14px] text-theme-text-light transition hover:bg-theme-tab-button-hover";
const memberMetaBadgeClass =
  "inline-flex items-center rounded-lg border border-theme-border bg-theme-bg-secondary/35 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-theme-text-muted";
const menuRowClass =
  "h-8 w-full cursor-pointer rounded-lg border border-transparent px-3 py-2 text-left text-sm text-theme-text-secondary hover:border-theme-border hover:bg-theme-bg-secondary/30 focus:border-theme-border focus:bg-theme-bg-secondary/30";
const menuSectionSeparatorClass =
  "mx-2 my-0 h-0 border-b border-theme-border bg-transparent";
const menuIconShellClass =
  " flex h-6 w-6 items-center justify-center rounded-lg border border-theme-border bg-theme-bg-primary/55 text-theme-text-secondary";

interface MembersTabProps {
  board: Pick<
    BoardWithData,
    "id" | "profileId" | "currentMember" | "memberCount"
  >;
  currentProfileId?: string;
}

export const MembersTab = ({ board, currentProfileId }: MembersTabProps) => {
  const queryClient = useQueryClient();
  const [loadingId, setLoadingId] = useState("");
  const { t } = useTranslation();
  const {
    pageSlots,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    containerRef,
    bottomSentinelRef,
  } = useBoardMembers(board.id, {
    rowHeight: 58,
    rowGap: 8,
    maxRenderedPages: 5,
  });

  // Find current user's member record and role
  const currentMember =
    board.currentMember?.profileId === currentProfileId
      ? board.currentMember
      : null;
  const currentRole = currentMember?.role || "GUEST";

  // What roles can the current user assign?
  const assignableRoles = assignableBy(currentRole);
  const canAssignRoles = assignableRoles.length > 0;
  const currentCanKick = canKick(currentRole);
  const currentCanBan = canBan(currentRole);
  const currentCanWarn = canWarn(currentRole);

  // Check if current user can modify a specific member
  const canModifyMember = (targetRole: MemberRole) => {
    return outranks(currentRole, targetRole);
  };

  // Mutation para kick - uses POST /api/boards/[boardId]/kick
  const kickMutation = useMutation({
    mutationFn: async ({
      memberId,
      targetProfileId,
    }: {
      memberId: string;
      targetProfileId: string;
    }) => {
      await axios.post(`/api/boards/${board.id}/kick`, { targetProfileId });
      return memberId;
    },
    onMutate: ({ memberId }) => {
      setLoadingId(memberId);
    },
    onSuccess: async (memberId, { targetProfileId }) => {
      removeBoardMemberFromCache(queryClient, board.id, {
        memberId,
        profileId: targetProfileId,
      });
      await queryClient.refetchQueries({
        queryKey: boardQueryKey(board.id),
        exact: true,
        type: "active",
      });
    },
    onError: (error: unknown) => {
      console.error(error);
    },
    onSettled: () => {
      setLoadingId("");
    },
  });

  // Mutation para cambio de rol - uses PATCH /api/boards/[boardId]/members/[memberId]
  const roleChangeMutation = useMutation({
    mutationFn: async ({
      memberId,
      role,
    }: {
      memberId: string;
      role: MemberRole;
    }) => {
      await axios.patch(`/api/boards/${board.id}/members/${memberId}`, {
        role,
      });
      return { memberId, role };
    },
    onMutate: ({ memberId }) => {
      setLoadingId(memberId);
    },
    onSuccess: async ({ memberId, role }) => {
      patchBoardMemberInCache(queryClient, board.id, memberId, (member) => ({
        ...member,
        role,
      }));

      if (board.currentMember?.id === memberId) {
        queryClient.setQueryData<BoardWithData>(
          boardQueryKey(board.id),
          (old) =>
            old?.currentMember
              ? {
                  ...old,
                  currentMember: {
                    ...old.currentMember,
                    role,
                  },
                }
              : old,
        );
      }
    },
    onError: (error: unknown) => {
      console.error(error);
    },
    onSettled: () => {
      setLoadingId("");
    },
  });

  const banMutation = useMutation({
    mutationFn: async ({
      memberId,
      targetProfileId,
    }: {
      memberId: string;
      targetProfileId: string;
    }) => {
      await axios.post(`/api/boards/${board.id}/ban`, { targetProfileId });
      return memberId;
    },
    onMutate: ({ memberId }) => {
      setLoadingId(memberId);
    },
    onSuccess: async (memberId, { targetProfileId }) => {
      removeBoardMemberFromCache(queryClient, board.id, {
        memberId,
        profileId: targetProfileId,
      });
      await Promise.all([
        queryClient.refetchQueries({
          queryKey: boardQueryKey(board.id),
          exact: true,
          type: "active",
        }),
        queryClient.refetchQueries({ queryKey: ["boardBans", board.id] }),
      ]);
    },
    onError: (error: unknown) => {
      console.error(error);
    },
    onSettled: () => {
      setLoadingId("");
    },
  });

  const warnMutation = useMutation({
    mutationFn: async ({
      memberId,
      targetProfileId,
    }: {
      memberId: string;
      targetProfileId: string;
    }) => {
      const response = await axios.post(`/api/boards/${board.id}/warning`, {
        targetProfileId,
      });
      return {
        memberId,
        targetProfileId,
        data: response.data as {
          autoBanned?: boolean;
          warning?: { id?: string };
        },
      };
    },
    onMutate: ({ memberId }) => {
      setLoadingId(memberId);
    },
    onSuccess: async ({ memberId, targetProfileId, data }) => {
      if (data.autoBanned) {
        removeBoardMemberFromCache(queryClient, board.id, {
          memberId,
          profileId: targetProfileId,
        });
        await Promise.all([
          queryClient.refetchQueries({
            queryKey: boardQueryKey(board.id),
            exact: true,
            type: "active",
          }),
          queryClient.refetchQueries({ queryKey: ["boardBans", board.id] }),
        ]);
      } else {
        patchBoardMemberInCache(queryClient, board.id, memberId, (member) => ({
          ...member,
          activeWarningCount: member.activeWarningCount + 1,
          latestActiveWarningId:
            data.warning?.id ?? member.latestActiveWarningId,
        }));
      }

      toast.success(
        data.autoBanned
          ? `${t.overlays.boardSettings.members.warnSuccess} (${t.overlays.boardSettings.members.autoBanTriggered})`
          : t.overlays.boardSettings.members.warnSuccess,
      );
    },
    onError: (error: unknown) => {
      console.error(error);
      toast.error(t.overlays.boardSettings.members.warnError);
    },
    onSettled: () => {
      setLoadingId("");
    },
  });

  const removeWarningMutation = useMutation({
    mutationFn: async ({
      memberId,
      warningId,
    }: {
      memberId: string;
      warningId: string;
    }) => {
      await axios.delete(`/api/boards/${board.id}/warnings/${warningId}`);
      return memberId;
    },
    onMutate: ({ memberId }) => {
      setLoadingId(memberId);
    },
    onSuccess: async (memberId, { warningId }) => {
      patchBoardMemberInCache(queryClient, board.id, memberId, (member) => ({
        ...member,
        activeWarningCount: Math.max(0, member.activeWarningCount - 1),
        latestActiveWarningId:
          member.latestActiveWarningId === warningId
            ? null
            : member.latestActiveWarningId,
      }));
      await queryClient.refetchQueries({ queryKey: ["boardBans", board.id] });
      toast.success(t.overlays.boardSettings.members.removeWarningSuccess);
    },
    onError: (error: unknown) => {
      console.error(error);
      toast.error(t.overlays.boardSettings.members.removeWarningError);
    },
    onSettled: () => {
      setLoadingId("");
    },
  });

  return (
    <div className="flex h-full min-h-0 flex-col space-y-6">
      <div className={HEADER_PANEL_SHELL}>
        <div className="border-b border-theme-border pb-0.5 -mb-3 -mt-3">
          <h2 className="text-2xl font-bold text-theme-text-primary">
            {t.overlays.boardSettings.members.title}
          </h2>
          <p className="-mt-1 text-sm text-theme-text-tertiary">
            {board.memberCount}{" "}
            {board.memberCount === 1 ? t.common.member : t.common.members}
          </p>
        </div>
      </div>

      <div
        ref={containerRef}
        className="scrollbar-ultra-thin min-h-0 flex-1 overflow-y-auto pr-6 -mt-4"
      >
        <div className="space-y-2 ">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-theme-text-tertiary">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading members...</span>
            </div>
          ) : null}

          {pageSlots.map((slot) =>
            slot.type === "virtualized" ? (
              <div
                key={`members-placeholder-${slot.pageIndex}`}
                style={{ height: slot.height }}
              />
            ) : (
              <div key={`members-page-${slot.pageIndex}`} className="space-y-2">
                {slot.page.items.map((member) => {
                  // Check if current user can modify this member
                  const canModify = canModifyMember(member.role);
                  const showActions =
                    member.profile.id !== currentProfileId &&
                    loadingId !== member.id &&
                    canModify &&
                    (canAssignRoles || currentCanKick || currentCanWarn || currentCanBan);

                  return (
                    <div
                      key={member.id}
                      className={cn(MEMBER_ROW_CLASS, "gap-2")}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <UserAvatar
                          src={member.profile.avatarAsset?.url || ""}
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
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className={memberMetaBadgeClass}>
                              Lv. {member.level}
                            </span>
                            <span
                              className={cn(
                                memberMetaBadgeClass,
                                member.activeWarningCount >= 2 &&
                                  "border-[#8a5a2c] bg-[#5a3a14]/25 text-[#f2c084]",
                              )}
                            >
                              {t.moderation.warnings}:{" "}
                              {member.activeWarningCount}/3
                            </span>
                          </div>
                        </div>
                      </div>
                      {showActions && (
                        <div className="ml-auto">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className={actionButtonClass}>
                                {t.overlays.boardSettings.members.actions}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              side="left"
                              className="z-10000 w-48 !animate-none rounded-lg border-theme-border bg-theme-bg-dropdown-menu-primary px-1 py-0.5 text-xs font-medium text-theme-text-secondary"
                            >
                              {canAssignRoles && (
                                <>
                                  {assignableRoles.includes("GUEST") && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        roleChangeMutation.mutate({
                                          memberId: member.id,
                                          role: "GUEST",
                                        })
                                      }
                                      className={cn(
                                        menuRowClass,
                                        member.role === "GUEST" &&
                                          "border-theme-border bg-theme-channel-type-active-bg text-theme-text-light hover:bg-theme-tab-button-bg focus:bg-theme-tab-button-bg",
                                      )}
                                    >
                                      <span className={menuIconShellClass}>
                                        <User className="h-3.5 w-3.5" />
                                      </span>
                                      {
                                        t.overlays.boardSettings.members.roles
                                          .guest
                                      }
                                      {member.role === "GUEST" && (
                                        <Check className="ml-auto h-4 w-4" />
                                      )}
                                    </DropdownMenuItem>
                                  )}
                                  {assignableRoles.includes("MODERATOR") && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        roleChangeMutation.mutate({
                                          memberId: member.id,
                                          role: "MODERATOR",
                                        })
                                      }
                                      className={cn(
                                        menuRowClass,
                                        member.role === "MODERATOR" &&
                                          "border-theme-border bg-theme-channel-type-active-bg text-theme-text-light hover:bg-theme-tab-button-bg focus:bg-theme-tab-button-bg",
                                      )}
                                    >
                                      <span className={menuIconShellClass}>
                                        <Ghost className="h-3.5 w-3.5" />
                                      </span>
                                      {
                                        t.overlays.boardSettings.members.roles
                                          .moderator
                                      }
                                      {member.role === "MODERATOR" && (
                                        <Check className="ml-auto h-4 w-4" />
                                      )}
                                    </DropdownMenuItem>
                                  )}
                                  {assignableRoles.includes("ADMIN") && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        roleChangeMutation.mutate({
                                          memberId: member.id,
                                          role: "ADMIN",
                                        })
                                      }
                                      className={cn(
                                        menuRowClass,
                                        member.role === "ADMIN" &&
                                          "border-theme-border bg-theme-channel-type-active-bg text-theme-text-light hover:bg-theme-tab-button-bg focus:bg-theme-tab-button-bg",
                                      )}
                                    >
                                      <span className={menuIconShellClass}>
                                        <HardHat className="h-3.5 w-3.5" />
                                      </span>
                                      {
                                        t.overlays.boardSettings.members.roles
                                          .admin
                                      }
                                      {member.role === "ADMIN" && (
                                        <Check className="ml-auto h-4 w-4" />
                                      )}
                                    </DropdownMenuItem>
                                  )}
                                </>
                              )}
                              {canAssignRoles && (currentCanKick || currentCanBan) && (
                                <DropdownMenuSeparator
                                  className={menuSectionSeparatorClass}
                                />
                              )}
                              {currentCanKick && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    kickMutation.mutate({
                                      memberId: member.id,
                                      targetProfileId: member.profile.id,
                                    })
                                  }
                                  className={menuRowClass}
                                >
                                  <span className={menuIconShellClass}>
                                    <UserMinus className="h-3.5 w-3.5" />
                                  </span>
                                  {t.overlays.boardSettings.members.kick}
                                </DropdownMenuItem>
                              )}
                              {currentCanKick && currentCanBan && (
                                <DropdownMenuSeparator
                                  className={menuSectionSeparatorClass}
                                />
                              )}
                              {currentCanWarn && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      warnMutation.mutate({
                                        memberId: member.id,
                                        targetProfileId: member.profile.id,
                                      })
                                    }
                                    className={menuRowClass}
                                  >
                                    <span className={menuIconShellClass}>
                                      <Plus className="h-3.5 w-3.5" />
                                    </span>
                                    {t.overlays.boardSettings.members.warn}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      if (!member.latestActiveWarningId) return;
                                      removeWarningMutation.mutate({
                                        memberId: member.id,
                                        warningId: member.latestActiveWarningId,
                                      });
                                    }}
                                    disabled={!member.latestActiveWarningId}
                                    className={cn(
                                      menuRowClass,
                                      !member.latestActiveWarningId &&
                                        "cursor-not-allowed opacity-50 hover:border-transparent hover:bg-transparent focus:border-transparent focus:bg-transparent",
                                    )}
                                  >
                                    <span className={menuIconShellClass}>
                                      <Minus className="h-3.5 w-3.5" />
                                    </span>
                                    {
                                      t.overlays.boardSettings.members
                                        .removeWarning
                                    }
                                  </DropdownMenuItem>
                                  {currentCanBan && (
                                      className={menuSectionSeparatorClass}
                                    />
                                  )}
                                </>
                              )}
                              {currentCanBan && (
                                      memberId: member.id,
                                      targetProfileId: member.profile.id,
                                    })
                                  }
                                  className={cn(menuRowClass, "text-[#d36a6a]")}
                                >
                                  <span className={cn(menuIconShellClass)}>
                                    <Gavel className="h-3.5 w-3.5 text-[#d36a6a]" />
                                  </span>
                                  {t.overlays.boardSettings.members.ban}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                      {loadingId === member.id && (
                        <Loader2 className="animate-spin text-theme-text-tertiary ml-auto w-4 h-4" />
                      )}
                    </div>
                  );
                })}
              </div>
            ),
          )}

          <div ref={bottomSentinelRef} className="h-1" />

          {hasNextPage ? (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className={actionButtonClass}
              >
                {isFetchingNextPage ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  "Load more"
                )}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
