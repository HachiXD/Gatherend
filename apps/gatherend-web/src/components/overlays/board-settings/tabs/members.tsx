"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "@/components/user-avatar";
import {
  Check,
  Crown,
  Gavel,
  Ghost,
  HardHat,
  Loader2,
  ShieldOff,
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
import { MemberRole, Member, Profile } from "@prisma/client";
import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import type {
  ClientStickerAssetRef,
  ClientUploadedAsset,
} from "@/types/uploaded-assets";

const roleIconMap = {
  GUEST: null,
  MODERATOR: <Ghost className="ml-2 h-4 w-4 text-indigo-500" />,
  ADMIN: <HardHat className="h-4 w-4 text-rose-500" />,
  OWNER: <Crown className="ml-2 h-4 w-4 text-[#FFD700]" />,
};

// Role hierarchy (lower index = higher rank)
const ROLE_HIERARCHY: Record<MemberRole, number> = {
  OWNER: 0,
  ADMIN: 1,
  MODERATOR: 2,
  GUEST: 3,
};

// Roles each actor can assign
const ASSIGNABLE_BY_ROLE: Record<MemberRole, MemberRole[]> = {
  OWNER: ["ADMIN", "MODERATOR", "GUEST"],
  ADMIN: ["MODERATOR", "GUEST"],
  MODERATOR: [],
  GUEST: [],
};

// Roles that can kick (OWNER, ADMIN, MODERATOR)
const CAN_KICK_ROLES: MemberRole[] = ["OWNER", "ADMIN", "MODERATOR"];
const HEADER_PANEL_SHELL =
  "border border-theme-border bg-theme-bg-overlay-primary/78 px-4 mr-1.5 pt-4 pb-0  shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.26)] sm:px-5 sm:py-5";
const MEMBER_ROW_CLASS =
  "flex min-h-10 items-center gap-3 rounded-none border border-theme-border-subtle bg-theme-bg-edit-form/50 px-3 py-1";
const actionButtonClass =
  "h-6.5 min-w-[120px] cursor-pointer rounded-none bg-theme-tab-button-bg px-3 text-[14px] text-theme-text-light transition hover:bg-theme-tab-button-hover";
const menuPanelShadow =
  "shadow-[0_10px_24px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.1),inset_1px_0_0_rgba(255,255,255,0.08),inset_-1px_0_0_rgba(0,0,0,0.38),inset_0_-1px_0_rgba(0,0,0,0.38)]";
const menuRowClass =
  "h-8 w-full cursor-pointer rounded-none border border-transparent px-3 py-2 text-left text-sm text-theme-text-secondary hover:border-theme-border hover:bg-theme-bg-secondary/30 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.28)] focus:border-theme-border focus:bg-theme-bg-secondary/30 focus:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.28)]";
const menuSectionSeparatorClass =
  "mx-2 my-0 h-0 border-b border-theme-border bg-transparent";
const menuIconShellClass =
  " flex h-6 w-6 items-center justify-center rounded-none border border-theme-border bg-theme-bg-primary/55 text-theme-text-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_1px_0_0_rgba(255,255,255,0.12),inset_-1px_0_0_rgba(0,0,0,0.38),inset_0_-1px_0_rgba(0,0,0,0.38)]";

interface MembersTabProps {
  board: {
    id: string;
    profileId: string | null;
    members: (Member & {
      profile: Pick<Profile, "id" | "username" | "discriminator"> & {
        avatarAsset: ClientUploadedAsset | null;
        badgeSticker: ClientStickerAssetRef | null;
      };
    })[];
  };
  currentProfileId?: string;
}

export const MembersTab = ({ board, currentProfileId }: MembersTabProps) => {
  const queryClient = useQueryClient();
  const [loadingId, setLoadingId] = useState("");
  const { t } = useTranslation();

  // Find current user's member record and role
  const currentMember = board.members.find(
    (m) => m.profile.id === currentProfileId,
  );
  const currentRole = currentMember?.role || "GUEST";

  // What roles can the current user assign?
  const assignableRoles = ASSIGNABLE_BY_ROLE[currentRole];
  const canAssignRoles = assignableRoles.length > 0;
  const canKick = CAN_KICK_ROLES.includes(currentRole);
  const canBan = currentRole === "OWNER" || currentRole === "ADMIN";

  // Check if current user can modify a specific member
  const canModifyMember = (targetRole: MemberRole) => {
    // Cannot modify someone with equal or higher rank
    return ROLE_HIERARCHY[currentRole] < ROLE_HIERARCHY[targetRole];
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["board", board.id],
        exact: true,
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
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["board", board.id] });
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
    onSuccess: async () => {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["board", board.id] }),
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

  return (
    <div className="space-y-6">
      <div className={HEADER_PANEL_SHELL}>
        <div className="border-b border-theme-border pb-0.5 -mb-3 -mt-3">
          <h2 className="text-2xl font-bold text-theme-text-primary">
            {t.overlays.boardSettings.members.title}
          </h2>
          <p className="-mt-1 text-sm text-theme-text-tertiary">
            {board?.members?.length}{" "}
            {board?.members?.length === 1 ? t.common.member : t.common.members}
          </p>
        </div>
      </div>

      <ScrollArea className="max-h-[500px] pr-6 -mt-4">
        <div className="space-y-2 ">
          {board?.members?.map((member) => {
            // Check if current user can modify this member
            const canModify = canModifyMember(member.role);
            const showActions =
              member.profile.id !== currentProfileId &&
              loadingId !== member.id &&
              canModify &&
              (canAssignRoles || canKick || canBan);

            return (
              <div key={member.id} className={cn(MEMBER_ROW_CLASS, "gap-2")}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <UserAvatar
                    src={member.profile.avatarAsset?.url || ""}
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
                        className={`z-10000 w-48 !animate-none rounded-none border-theme-border bg-theme-bg-dropdown-menu-primary px-1 py-0.5 text-xs font-medium text-theme-text-secondary ${menuPanelShadow}`}
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
                                {t.overlays.boardSettings.members.roles.guest}
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
                                {t.overlays.boardSettings.members.roles.admin}
                                {member.role === "ADMIN" && (
                                  <Check className="ml-auto h-4 w-4" />
                                )}
                              </DropdownMenuItem>
                            )}
                          </>
                        )}
                        {canAssignRoles && (canKick || canBan) && (
                          <DropdownMenuSeparator
                            className={menuSectionSeparatorClass}
                          />
                        )}
                        {canKick && (
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
                        {canKick && canBan && (
                          <DropdownMenuSeparator
                            className={menuSectionSeparatorClass}
                          />
                        )}
                        {canBan && (
                          <DropdownMenuItem
                            onClick={() =>
                              banMutation.mutate({
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
      </ScrollArea>
    </div>
  );
};
