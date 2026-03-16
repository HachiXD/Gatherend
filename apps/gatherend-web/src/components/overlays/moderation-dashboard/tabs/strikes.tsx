"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

interface StrikeItem {
  id: string;
  reason: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  contentType: string;
  createdAt: string;
  expiresAt: string | null;
  autoDetected: boolean;
  profile: {
    id: string;
    userId: string;
    username: string;
    discriminator: string | null;
    avatarAsset: ClientUploadedAsset | null;
    banned: boolean;
  };
  originReport: {
    id: string;
    targetType: string;
    category: string;
  } | null;
}

interface StrikesResponse {
  strikes: StrikeItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const fetchStrikes = async (filter: string): Promise<StrikesResponse> => {
  const res = await fetch(`/api/moderation/strikes?filter=${filter}`);
  if (!res.ok) throw new Error("Failed to fetch strikes");
  return res.json();
};

const deleteStrike = async (strikeId: string): Promise<void> => {
  const res = await fetch(`/api/moderation/strikes/${strikeId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete strike");
};

export const StrikesTab = () => {
  const [filter, setFilter] = useState<"active" | "expired" | "all">("active");
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["moderation", "strikes", filter],
    queryFn: () => fetchStrikes(filter),
    staleTime: 0,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStrike,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moderation", "strikes"] });
      queryClient.invalidateQueries({ queryKey: ["moderation", "stats"] });
    },
  });

  const handleDeleteStrike = (strikeId: string) => {
    if (!confirm("Are you sure you want to delete this strike?")) return;
    deleteMutation.mutate(strikeId);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "text-red-500 bg-red-500/10 border-red-500/20";
      case "HIGH":
        return "text-orange-500 bg-orange-500/10 border-orange-500/20";
      case "MEDIUM":
        return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
      default:
        return "text-gray-400 bg-gray-500/10 border-gray-500/20";
    }
  };

  const strikes = data?.strikes ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-theme-text-primary">
            Strikes
          </h1>
          <p className="text-sm text-theme-text-subtle mt-1">
            View and manage user warnings
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="px-3 py-1.5 rounded-md bg-theme-bg-input border border-theme-border-primary text-sm text-theme-text-primary"
          >
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="all">All</option>
          </select>

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
      </div>

      {/* Strikes List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-theme-text-subtle" />
          </div>
        ) : strikes.length === 0 ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-12 h-12 text-theme-text-tertiary mx-auto mb-3" />
            <p className="text-theme-text-subtle">No strikes found</p>
          </div>
        ) : (
          strikes.map((strike) => (
            <div
              key={strike.id}
              className={cn(
                "p-4 rounded-lg border transition",
                getSeverityColor(strike.severity)
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <img
                    src={strike.profile.avatarAsset?.url || undefined}
                    alt=""
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <p className="font-medium text-theme-text-primary">
                      @{strike.profile.username}/{strike.profile.discriminator}
                      {strike.profile.banned && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">
                          BANNED
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-theme-text-subtle mt-1">
                      {strike.reason}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-theme-text-tertiary">
                      <span>{strike.contentType}</span>
                      <span className="font-medium">{strike.severity}</span>
                      <span>
                        {new Date(strike.createdAt).toLocaleDateString()}
                      </span>
                      {strike.expiresAt && (
                        <span>
                          Expires:{" "}
                          {new Date(strike.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                      {strike.originReport && (
                        <span className="text-theme-accent-primary">
                          From Report: {strike.originReport.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteStrike(strike.id)}
                  disabled={deleteMutation.isPending}
                  className="p-2 rounded-md hover:bg-red-500/20 transition text-red-400 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
