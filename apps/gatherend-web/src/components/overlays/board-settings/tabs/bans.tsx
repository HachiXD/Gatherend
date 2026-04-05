"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "@/components/user-avatar";
import { Loader2, Gavel } from "lucide-react";
import { BoardBanSourceType, Profile } from "@prisma/client";
import axios from "axios";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

const HEADER_PANEL_SHELL =
  "border border-theme-border bg-theme-bg-overlay-primary/78 mr-1.5 pt-4 pb-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.26)] sm:px-5 sm:py-5";
const BAN_ROW_CLASS =
  "flex min-h-10 items-center gap-3 rounded-none border border-theme-border-subtle bg-theme-bg-edit-form/50 px-3 py-1";
const actionButtonClass =
  "h-6.5 min-w-[120px] cursor-pointer rounded-none bg-theme-tab-button-bg px-3 text-[14px] text-theme-text-light transition hover:bg-theme-tab-button-hover";
const sourceBadgeClass =
  "inline-flex items-center rounded-none border border-theme-border bg-theme-bg-secondary/35 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-theme-text-muted";

interface BannedUser {
  id: string;
  profileId: string;
  createdAt: string;
  sourceType: BoardBanSourceType;
  issuedBy: Pick<Profile, "id" | "username" | "discriminator"> & {
    avatarAsset: ClientUploadedAsset | null;
  };
  profile: Pick<Profile, "id" | "username" | "discriminator"> & {
    avatarAsset: ClientUploadedAsset | null;
  };
}

interface BoardBansPage {
  items: BannedUser[];
  bans: BannedUser[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface BansTabProps {
  boardId: string;
}

export const BansTab = ({ boardId }: BansTabProps) => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const getSourceLabel = (sourceType: BoardBanSourceType) =>
    sourceType === "WARNING_THRESHOLD"
      ? t.overlays.boardSettings.bans.autoBanLabel
      : t.overlays.boardSettings.bans.manualBanLabel;

  const getSourceDescription = (ban: BannedUser) =>
    ban.sourceType === "WARNING_THRESHOLD"
      ? t.overlays.boardSettings.bans.autoBanDescription
      : t.overlays.boardSettings.bans.manualBanDescription.replace(
          "{username}",
          ban.issuedBy.username,
        );

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["boardBans", boardId],
    queryFn: async ({
      pageParam,
    }: {
      pageParam?: string | null;
    }): Promise<BoardBansPage> => {
      const response = await axios.get<BoardBansPage>(`/api/boards/${boardId}/bans`, {
        params: {
          cursor: pageParam ?? undefined,
          limit: 20,
        },
      });
      return response.data;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    staleTime: 1000 * 60, // 1 minuto
  });

  const bannedUsers = data?.pages.flatMap((page) => page.items) ?? [];

  // Mutation para unban
  const unbanMutation = useMutation({
    mutationFn: async (profileId: string) => {
      await axios.post(`/api/boards/${boardId}/unban`, {
        targetProfileId: profileId,
      });
      return profileId;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["boardBans", boardId],
      });
      toast.success(t.overlays.boardSettings.bans.unbanSuccess);
    },
    onError: () => {
      toast.error(t.overlays.boardSettings.bans.unbanError);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className={HEADER_PANEL_SHELL}>
          <div className="border-b border-theme-border pb-0.5 -mb-3 -mt-3">
            <h2 className="text-2xl font-bold text-theme-text-primary">
              {t.overlays.boardSettings.bans.title}
            </h2>
            <p className="-mt-1 text-sm text-theme-text-tertiary">
              {t.overlays.boardSettings.bans.loading}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={HEADER_PANEL_SHELL}>
        <div className="border-b border-theme-border pb-0.5 -mb-3 -mt-3">
          <h2 className="text-2xl font-bold text-theme-text-primary">
            {t.overlays.boardSettings.bans.title}
          </h2>
          <p className="-mt-1 text-sm text-theme-text-tertiary">
            {bannedUsers.length}{" "}
            {bannedUsers.length === 1
              ? t.overlays.boardSettings.bans.user
              : t.overlays.boardSettings.bans.users}{" "}
            {t.overlays.boardSettings.bans.bannedFromThisBoard}
          </p>
        </div>
      </div>

      {bannedUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-1 text-center">
          <Gavel className="h-12 w-12 text-theme-text-muted mb-3" />
          <p className="text-md font-medium text-theme-text-tertiary">
            {t.overlays.boardSettings.bans.emptyTitle}
          </p>
          <p className="text-sm text-theme-text-muted mt-1">
            {t.overlays.boardSettings.bans.emptyDescription}
          </p>
        </div>
      ) : (
        <ScrollArea className="max-h-[500px] pr-6 -mt-4">
          <div className="space-y-4">
            {bannedUsers.map((ban) => (
              <div key={ban.id} className={BAN_ROW_CLASS}>
                <UserAvatar
                  src={ban.profile.avatarAsset?.url || ""}
                  profileId={ban.profile.id}
                  showStatus={false}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-theme-text-primary">
                    <span className="truncate">{ban.profile.username}</span>
                    <span
                      className={cn(
                        sourceBadgeClass,
                        ban.sourceType === "WARNING_THRESHOLD" &&
                          "border-[#8a5a2c] bg-[#5a3a14]/25 text-[#f2c084]",
                      )}
                    >
                      {getSourceLabel(ban.sourceType)}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-theme-text-tertiary">
                    /{ban.profile.discriminator}
                  </p>
                  <p className="text-[11px] text-theme-text-muted">
                    {t.overlays.boardSettings.bans.bannedOn}{" "}
                    {new Date(ban.createdAt).toLocaleDateString()}
                  </p>
                  <p className="mt-1 text-[11px] text-theme-text-muted">
                    {getSourceDescription(ban)}
                  </p>
                </div>
                {unbanMutation.isPending &&
                unbanMutation.variables === ban.profileId ? (
                  <Loader2 className="ml-auto h-4 w-4 animate-spin text-theme-text-tertiary" />
                ) : (
                  <Button
                    onClick={() => unbanMutation.mutate(ban.profileId)}
                    className={actionButtonClass}
                    disabled={unbanMutation.isPending}
                  >
                    {t.overlays.boardSettings.bans.unban}
                  </Button>
                )}
              </div>
            ))}
            {hasNextPage && (
              <div className="flex justify-center pt-2">
                <Button
                  onClick={() => fetchNextPage()}
                  className={actionButtonClass}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t.discovery.loadMore
                  )}
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};
