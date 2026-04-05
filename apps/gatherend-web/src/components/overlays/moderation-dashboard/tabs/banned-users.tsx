"use client";

import { Loader2, RefreshCw, UserCheck, UserX } from "lucide-react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import {
  fetchBannedUsers,
  flattenCursorPages,
  invalidateModerationDashboardQueries,
  type ModerationProfile,
  unbanUser,
} from "../lib";

const HEADER_PANEL_SHELL =
  "border border-theme-border bg-theme-bg-overlay-primary/78 px-4 pt-4 pb-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.26)] sm:px-5 sm:py-5";
const USER_ROW_CLASS =
  "flex min-h-10 items-center gap-3 rounded-none border border-theme-border-subtle bg-theme-bg-edit-form/50 px-3 py-1";
const actionButtonClass =
  "h-6.5 min-w-[120px] cursor-pointer rounded-none bg-theme-tab-button-bg px-3 text-[14px] text-theme-text-light transition hover:bg-theme-tab-button-hover";

export const BannedUsersTab = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["moderation", "banned-users"],
    queryFn: ({ pageParam }: { pageParam?: string | null }) =>
      fetchBannedUsers(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    staleTime: 30_000,
  });

  const bannedUsers = flattenCursorPages<ModerationProfile>(data);
  const total = data?.pages[0]?.total ?? bannedUsers.length;

  const unbanMutation = useMutation({
    mutationFn: (profileId: string) => unbanUser(profileId),
    onSuccess: async (_data, profileId) => {
      await invalidateModerationDashboardQueries(queryClient, profileId);
      toast.success(t.moderation.unbanSuccess);
    },
    onError: (error: unknown) => {
      console.error(error);
      toast.error(t.moderation.unbanError);
    },
  });

  return (
    <div className="space-y-6">
      <div className={HEADER_PANEL_SHELL}>
        <div className="-mb-3 -mt-3 border-b border-theme-border pb-0.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-theme-text-primary">
                {t.moderation.bannedUsers}
              </h2>
              <p className="-mt-1 text-sm text-theme-text-tertiary">
                {t.moderation.bannedUsersSubtitle}
              </p>
            </div>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="cursor-pointer rounded-none border border-theme-border bg-theme-bg-secondary/35 p-2 text-theme-text-subtle transition hover:text-theme-text-light disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="border border-theme-border bg-theme-bg-overlay-primary/50 px-4 py-3">
        <p className="text-2xl font-bold text-red-400">{total}</p>
        <p className="text-sm text-theme-text-subtle">
          {t.moderation.totalBannedUsers}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-theme-text-tertiary" />
        </div>
      ) : bannedUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-1 text-center">
          <UserX className="mb-3 h-12 w-12 text-theme-text-muted" />
          <p className="text-md font-medium text-theme-text-tertiary">
            {t.moderation.noBannedUsers}
          </p>
          <p className="mt-1 text-sm text-theme-text-muted">
            {t.moderation.noBannedUsersDescription}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {bannedUsers.map((user) => (
            <div key={user.id} className={USER_ROW_CLASS}>
              <img
                src={user.avatarAsset?.url || undefined}
                alt=""
                className="h-10 w-10 rounded-full opacity-60"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-theme-text-primary line-through opacity-80">
                  @{user.username}
                  {user.discriminator ? `/${user.discriminator}` : ""}
                </div>
                <p className="text-[11px] text-theme-text-muted">
                  {user.banReason || t.moderation.noReasonProvided}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-theme-text-tertiary">
                  {user.bannedAt && (
                    <span>
                      {t.moderation.bannedOn}{" "}
                      {new Date(user.bannedAt).toLocaleDateString()}
                    </span>
                  )}
                  {user._count?.strikes !== undefined && (
                    <span>{user._count.strikes} {t.moderation.strikes}</span>
                  )}
                  {user._count?.reportsAgainst !== undefined && (
                    <span>{user._count.reportsAgainst} {t.moderation.reports}</span>
                  )}
                </div>
              </div>
              {unbanMutation.isPending && unbanMutation.variables === user.id ? (
                <Loader2 className="ml-auto h-4 w-4 animate-spin text-theme-text-tertiary" />
              ) : (
                <Button
                  onClick={() => unbanMutation.mutate(user.id)}
                  className={actionButtonClass}
                  disabled={unbanMutation.isPending}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5" />
                    {t.moderation.unban}
                  </span>
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
      )}
    </div>
  );
};
