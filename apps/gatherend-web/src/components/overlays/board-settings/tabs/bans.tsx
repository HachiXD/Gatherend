"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "@/components/user-avatar";
import { Loader2, ShieldOff } from "lucide-react";
import { Profile } from "@prisma/client";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

interface BannedUser {
  id: string;
  profileId: string;
  createdAt: string;
  profile: Pick<Profile, "id" | "username" | "email" | "userId"> & {
    avatarAsset: ClientUploadedAsset | null;
  };
}

interface BansTabProps {
  boardId: string;
}

export const BansTab = ({ boardId }: BansTabProps) => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  // Query para obtener usuarios baneados
  const { data: bannedUsers = [], isLoading } = useQuery({
    queryKey: ["boardBans", boardId],
    queryFn: async () => {
      const response = await axios.get<BannedUser[]>(
        `/api/boards/${boardId}/bans`
      );
      return response.data;
    },
    staleTime: 1000 * 60, // 1 minuto
  });

  // Mutation para unban
  const unbanMutation = useMutation({
    mutationFn: async (profileId: string) => {
      await axios.post(`/api/boards/${boardId}/unban`, {
        targetProfileId: profileId,
      });
      return profileId;
    },
    onSuccess: (profileId) => {
      // Actualizar cache optimistamente
      queryClient.setQueryData<BannedUser[]>(
        ["boardBans", boardId],
        (old) => old?.filter((ban) => ban.profileId !== profileId) ?? []
      );
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      toast.success(t.overlays.boardSettings.bans.unbanSuccess);
    },
    onError: () => {
      toast.error(t.overlays.boardSettings.bans.unbanError);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-theme-text-primary">
            {t.overlays.boardSettings.bans.title}
          </h2>
          <p className="text-sm text-theme-text-tertiary">
            {t.overlays.boardSettings.bans.loading}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-theme-text-primary">
          {t.overlays.boardSettings.bans.title}
        </h2>
        <p className="text-sm text-theme-text-tertiary">
          {bannedUsers.length}{" "}
          {bannedUsers.length === 1
            ? t.overlays.boardSettings.bans.user
            : t.overlays.boardSettings.bans.users}{" "}
          {t.overlays.boardSettings.bans.bannedFromThisBoard}
        </p>
      </div>

      {bannedUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ShieldOff className="h-12 w-12 text-theme-text-muted mb-4" />
          <p className="text-sm font-medium text-theme-text-tertiary">
            {t.overlays.boardSettings.bans.emptyTitle}
          </p>
          <p className="text-xs text-theme-text-muted mt-1">
            {t.overlays.boardSettings.bans.emptyDescription}
          </p>
        </div>
      ) : (
        <ScrollArea className="max-h-[500px] pr-6">
          <div className="space-y-4">
            {bannedUsers.map((ban) => (
              <div key={ban.id} className="flex items-center gap-x-2">
                <UserAvatar
                  src={ban.profile.avatarAsset?.url || ""}
                  showStatus={false}
                />
                <div className="flex flex-col gap-y-1 flex-1">
                  <div className="text-sm font-semibold text-theme-text-primary">
                    {ban.profile.username}
                  </div>
                  <p className="text-xs text-theme-text-tertiary">
                    {ban.profile.email}
                  </p>
                  <p className="text-xs text-theme-text-muted">
                    {t.overlays.boardSettings.bans.bannedOn}{" "}
                    {new Date(ban.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {unbanMutation.isPending &&
                unbanMutation.variables === ban.profileId ? (
                  <Loader2 className="animate-spin text-theme-text-tertiary w-4 h-4" />
                ) : (
                  <Button
                    onClick={() => unbanMutation.mutate(ban.profileId)}
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    disabled={unbanMutation.isPending}
                  >
                    {t.overlays.boardSettings.bans.unban}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};
