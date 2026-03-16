"use client";

import { Loader2, RefreshCw, UserX, UserCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

interface BannedUser {
  id: string;
  userId: string;
  username: string;
  discriminator: string | null;
  avatarAsset: ClientUploadedAsset | null;
  bannedAt: string;
  banReason: string | null;
  _count: {
    strikes: number;
    reportsAgainst: number;
  };
}

interface BannedUsersResponse {
  bannedUsers: BannedUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const fetchBannedUsers = async (): Promise<BannedUsersResponse> => {
  const res = await fetch("/api/moderation/banned-users", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch banned users");
  return res.json();
};

const unbanUser = async (profileId: string): Promise<void> => {
  const res = await fetch(`/api/moderation/users/${profileId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "unban" }),
  });
  if (!res.ok) throw new Error("Failed to unban user");
};

export const BannedUsersTab = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["moderation", "banned-users"],
    queryFn: fetchBannedUsers,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const unbanMutation = useMutation({
    mutationFn: unbanUser,
    onSuccess: async () => {
      await queryClient.refetchQueries({
        queryKey: ["moderation", "banned-users"],
      });
      await queryClient.refetchQueries({ queryKey: ["moderation", "stats"] });
    },
  });

  const handleUnban = (user: BannedUser) => {
    if (
      !confirm(
        `Are you sure you want to unban @${user.username}/${user.discriminator}?`
      )
    ) {
      return;
    }
    unbanMutation.mutate(user.id);
  };

  const users = data?.bannedUsers ?? [];
  const total = data?.pagination.total ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-theme-text-primary">
            Banned Users
          </h1>
          <p className="text-sm text-theme-text-subtle mt-1">
            Users banned from the platform
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-2 rounded-md hover:bg-theme-bg-tab-hover transition disabled:opacity-50"
        >
          <RefreshCw
            className={`w-4 h-4 text-theme-text-subtle ${
              isFetching ? "animate-spin" : ""
            }`}
          />
        </button>
      </div>

      {/* Stats */}
      <div className="p-4 rounded-lg bg-theme-bg-secondary border border-theme-border-primary">
        <p className="text-2xl font-bold text-red-400">{total}</p>
        <p className="text-sm text-theme-text-subtle">Total Banned Users</p>
      </div>

      {/* Users List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-theme-text-subtle" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <UserX className="w-12 h-12 text-theme-text-tertiary mx-auto mb-3" />
            <p className="text-theme-text-subtle">No banned users</p>
            <p className="text-sm text-theme-text-tertiary mt-1">
              The platform is clean!
            </p>
          </div>
        ) : (
          users.map((user) => (
            <div
              key={user.id}
              className="p-4 rounded-lg bg-theme-bg-secondary border border-theme-border-primary"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={user.avatarAsset?.url || undefined}
                    alt=""
                    className="w-10 h-10 rounded-full opacity-50"
                  />
                  <div>
                    <p className="font-medium text-theme-text-primary line-through opacity-70">
                      @{user.username}/{user.discriminator}
                    </p>
                    <p className="text-sm text-theme-text-subtle">
                      {user.banReason || "No reason provided"}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-theme-text-tertiary">
                      <span>
                        Banned {new Date(user.bannedAt).toLocaleDateString()}
                      </span>
                      <span>{user._count.strikes} strikes</span>
                      <span>{user._count.reportsAgainst} reports</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleUnban(user)}
                  disabled={unbanMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-green-500/10 hover:bg-green-500/20 transition text-green-400 disabled:opacity-50"
                >
                  {unbanMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <UserCheck className="w-3 h-3" />
                  )}
                  Unban
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
