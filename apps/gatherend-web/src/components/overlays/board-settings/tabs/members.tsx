"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "@/components/user-avatar";
import {
  Check,
  Gavel,
  Loader2,
  MoreVertical,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
} from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { MemberRole, Member, Profile } from "@prisma/client";
import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBoardMutations } from "@/hooks/use-board-data";
import { useTranslation } from "@/i18n";
import type {
  ClientStickerAssetRef,
  ClientUploadedAsset,
} from "@/types/uploaded-assets";

const roleIconMap = {
  GUEST: null,
  MODERATOR: <ShieldCheck className="h-4 w-4 ml-2 text-indigo-500" />,
  ADMIN: <ShieldAlert className="h-4 w-4 text-rose-500" />,
  OWNER: <ShieldAlert className="h-4 w-4 text-emerald-500" />,
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

interface MembersTabProps {
  board: {
    id: string;
    profileId: string | null;
    members: (Member & {
      profile: Pick<
        Profile,
        "id" | "username" | "discriminator" | "email" | "userId"
      > & {
        avatarAsset: ClientUploadedAsset | null;
        badgeSticker: ClientStickerAssetRef | null;
      };
    })[];
  };
  currentProfileId?: string;
}

export const MembersTab = ({ board, currentProfileId }: MembersTabProps) => {
  const queryClient = useQueryClient();
  const { removeMember, updateMember } = useBoardMutations(board.id);
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
    onSuccess: (memberId: string) => {
      removeMember(memberId);
      queryClient.invalidateQueries({ queryKey: ["boards"] });
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
    onSuccess: ({ memberId, role }) => {
      updateMember(memberId, { role });
      queryClient.invalidateQueries({ queryKey: ["boards"] });
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
      <div>
        <h2 className="text-xl font-bold text-theme-text-primary">
          {t.overlays.boardSettings.members.title}
        </h2>
        <p className="text-sm text-theme-text-tertiary">
          {board?.members?.length}{" "}
          {board?.members?.length === 1 ? t.common.member : t.common.members}
        </p>
      </div>

      <ScrollArea className="max-h-[500px] pr-6">
        <div className="space-y-4">
          {board?.members?.map((member) => {
            // Check if current user can modify this member
            const canModify = canModifyMember(member.role);
            const showActions =
              member.profile.id !== currentProfileId &&
              loadingId !== member.id &&
              canModify &&
              (canAssignRoles || canKick);

            return (
              <div key={member.id} className="flex items-center gap-x-2">
                <UserAvatar
                  src={member.profile.avatarAsset?.url || ""}
                  showStatus={false}
                />
                <div className="flex flex-col gap-y-1">
                  <div className="text-sm font-semibold flex items-center gap-x-1 text-theme-text-primary">
                    {member.profile.username}
                    {roleIconMap[member.role]}
                  </div>
                  <p className="text-xs text-theme-text-tertiary">
                    {member.profile.email}
                  </p>
                </div>
                {showActions && (
                  <div className="ml-auto">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 rounded-md hover:bg-theme-bg-tertiary transition">
                          <MoreVertical className="h-4 w-4 text-theme-text-tertiary" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="left" className="z-10000">
                        {canAssignRoles && (
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="flex items-center">
                              <ShieldQuestion className="w-4 h-4 mr-2" />
                              <span>
                                {t.overlays.boardSettings.members.roleLabel}
                              </span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="z-10001">
                              {/* Show GUEST option if user can assign it */}
                              {assignableRoles.includes("GUEST") && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    roleChangeMutation.mutate({
                                      memberId: member.id,
                                      role: "GUEST",
                                    })
                                  }
                                >
                                  <Shield className="h-4 w-4 mr-2" />
                                  {t.overlays.boardSettings.members.roles.guest}
                                  {member.role === "GUEST" && (
                                    <Check className="h-4 w-4 ml-auto" />
                                  )}
                                </DropdownMenuItem>
                              )}
                              {/* Show MODERATOR option if user can assign it */}
                              {assignableRoles.includes("MODERATOR") && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    roleChangeMutation.mutate({
                                      memberId: member.id,
                                      role: "MODERATOR",
                                    })
                                  }
                                >
                                  <ShieldCheck className="h-4 w-4 mr-2" />
                                  {
                                    t.overlays.boardSettings.members.roles
                                      .moderator
                                  }
                                  {member.role === "MODERATOR" && (
                                    <Check className="h-4 w-4 ml-auto" />
                                  )}
                                </DropdownMenuItem>
                              )}
                              {/* Show ADMIN option if user can assign it */}
                              {assignableRoles.includes("ADMIN") && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    roleChangeMutation.mutate({
                                      memberId: member.id,
                                      role: "ADMIN",
                                    })
                                  }
                                >
                                  <ShieldAlert className="h-4 w-4 mr-2 text-rose-500" />
                                  {t.overlays.boardSettings.members.roles.admin}
                                  {member.role === "ADMIN" && (
                                    <Check className="h-4 w-4 ml-auto" />
                                  )}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        )}
                        {canKick && canAssignRoles && <DropdownMenuSeparator />}
                        {canKick && (
                          <DropdownMenuItem
                            onClick={() =>
                              kickMutation.mutate({
                                memberId: member.id,
                                targetProfileId: member.profile.id,
                              })
                            }
                          >
                            <Gavel className="h-4 w-4 mr-2" />
                            {t.overlays.boardSettings.members.kick}
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
