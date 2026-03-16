"use client";

import {
  Loader2,
  RefreshCw,
  TrendingUp,
  Flag,
  AlertTriangle,
  Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

interface ModerationProfile {
  id: string;
  username: string;
  discriminator: string | null;
  avatarAsset: ClientUploadedAsset | null;
}

interface ModerationStats {
  overview: {
    pendingReports: number;
    reviewingReports: number;
    actionTakenReports: number;
    dismissedReports: number;
    totalReports: number;
    totalStrikes: number;
    activeStrikes: number;
    bannedUsers: number;
    reportsToday: number;
    reportsThisWeek: number;
  };
  breakdown: {
    byCategory: Array<{ category: string; count: number }>;
    byType: Array<{ type: string; count: number }>;
  };
  recentReports: Array<{
    id: string;
    targetType: string;
    category: string;
    status: string;
    createdAt: string;
    reporter: {
      username: string;
      discriminator: string;
    };
  }>;
  topReporters: Array<{
    id: string;
    username: string;
    discriminator: string | null;
    avatarAsset: ClientUploadedAsset | null;
    validReports: number;
    falseReports: number;
    reportAccuracy: number | null;
  }>;
  mostReportedUsers: Array<ModerationProfile & {
    userId: string;
    banned: boolean;
    _count: {
      reportsAgainst: number;
      strikes: number;
    };
  }>;
}

const fetchStats = async (): Promise<ModerationStats> => {
  const res = await fetch("/api/moderation/stats");
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
};

export const StatsTab = () => {
  const {
    data: stats,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["moderation", "stats"],
    queryFn: fetchStats,
    staleTime: 30000, // 30 seconds
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-theme-text-subtle" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-theme-text-primary">
            Statistics
          </h1>
          <p className="text-sm text-theme-text-subtle mt-1">
            Moderation overview and metrics
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

      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-5 rounded-lg bg-theme-bg-secondary border border-theme-border-primary">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-theme-text-subtle">
              Pending Reports
            </span>
            {(stats?.overview.pendingReports ?? 0) > 0 && (
              <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
                Needs Attention
              </span>
            )}
          </div>
          <p className="text-3xl font-bold text-theme-text-primary">
            {stats?.overview.pendingReports ?? 0}
          </p>
          <p className="text-xs text-theme-text-tertiary mt-1">
            {stats?.overview.reviewingReports ?? 0} reviewing
          </p>
        </div>

        <div className="p-5 rounded-lg bg-theme-bg-secondary border border-theme-border-primary">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-theme-text-subtle">
              Reports This Week
            </span>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-theme-text-primary">
            {stats?.overview.reportsThisWeek ?? 0}
          </p>
          <p className="text-xs text-theme-text-tertiary mt-1">
            {stats?.overview.reportsToday ?? 0} today
          </p>
        </div>

        <div className="p-5 rounded-lg bg-theme-bg-secondary border border-theme-border-primary">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-theme-text-subtle">
              Active Strikes
            </span>
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
          </div>
          <p className="text-3xl font-bold text-theme-text-primary">
            {stats?.overview.activeStrikes ?? 0}
          </p>
          <p className="text-xs text-theme-text-tertiary mt-1">
            {stats?.overview.totalStrikes ?? 0} total
          </p>
        </div>

        <div className="p-5 rounded-lg bg-theme-bg-secondary border border-theme-border-primary">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-theme-text-subtle">Banned Users</span>
            <Ban className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-3xl font-bold text-red-400">
            {stats?.overview.bannedUsers ?? 0}
          </p>
        </div>
      </div>

      {/* Report Resolution Stats */}
      <div className="p-5 rounded-lg bg-theme-bg-secondary border border-theme-border-primary">
        <h3 className="text-sm font-medium text-theme-text-primary mb-4">
          Report Resolution
        </h3>
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center p-3 rounded bg-yellow-500/10">
            <p className="text-lg font-bold text-yellow-400">
              {stats?.overview.pendingReports ?? 0}
            </p>
            <p className="text-xs text-theme-text-tertiary">Pending</p>
          </div>
          <div className="text-center p-3 rounded bg-blue-500/10">
            <p className="text-lg font-bold text-blue-400">
              {stats?.overview.reviewingReports ?? 0}
            </p>
            <p className="text-xs text-theme-text-tertiary">Reviewing</p>
          </div>
          <div className="text-center p-3 rounded bg-green-500/10">
            <p className="text-lg font-bold text-green-400">
              {stats?.overview.actionTakenReports ?? 0}
            </p>
            <p className="text-xs text-theme-text-tertiary">Action Taken</p>
          </div>
          <div className="text-center p-3 rounded bg-gray-500/10">
            <p className="text-lg font-bold text-gray-400">
              {stats?.overview.dismissedReports ?? 0}
            </p>
            <p className="text-xs text-theme-text-tertiary">Dismissed</p>
          </div>
        </div>
      </div>

      {/* Reports by Category & Type */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-5 rounded-lg bg-theme-bg-secondary border border-theme-border-primary">
          <h3 className="text-sm font-medium text-theme-text-primary mb-4">
            Reports by Category
          </h3>
          <div className="space-y-3">
            {!stats?.breakdown.byCategory?.length ? (
              <p className="text-sm text-theme-text-tertiary">No data yet</p>
            ) : (
              stats.breakdown.byCategory.map((item) => (
                <div
                  key={item.category}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm text-theme-text-subtle capitalize">
                    {item.category.replace(/_/g, " ").toLowerCase()}
                  </span>
                  <span className="text-sm font-medium text-theme-text-primary">
                    {item.count}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-5 rounded-lg bg-theme-bg-secondary border border-theme-border-primary">
          <h3 className="text-sm font-medium text-theme-text-primary mb-4">
            Reports by Type
          </h3>
          <div className="space-y-3">
            {!stats?.breakdown.byType?.length ? (
              <p className="text-sm text-theme-text-tertiary">No data yet</p>
            ) : (
              stats.breakdown.byType.map((item) => (
                <div
                  key={item.type}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm text-theme-text-subtle">
                    {item.type}
                  </span>
                  <span className="text-sm font-medium text-theme-text-primary">
                    {item.count}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Most Reported Users */}
      <div className="p-5 rounded-lg bg-theme-bg-secondary border border-theme-border-primary">
        <h3 className="text-sm font-medium text-theme-text-primary mb-4">
          Most Reported Users
        </h3>
        {!stats?.mostReportedUsers?.length ? (
          <p className="text-sm text-theme-text-tertiary">No data yet</p>
        ) : (
          <div className="space-y-2">
            {stats.mostReportedUsers.slice(0, 5).map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 rounded bg-theme-bg-tertiary"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={user.avatarAsset?.url || undefined}
                    alt=""
                    className={cn(
                      "w-8 h-8 rounded-full",
                      user.banned && "opacity-50 grayscale"
                    )}
                  />
                  <div>
                    <p className="text-sm text-theme-text-primary">
                      @{user.username}/{user.discriminator}
                      {user.banned && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">
                          BANNED
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-theme-text-tertiary">
                      {user._count.strikes} strikes
                    </p>
                  </div>
                </div>
                <span className="text-sm font-medium text-red-400">
                  {user._count.reportsAgainst} reports
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Reporters */}
      <div className="p-5 rounded-lg bg-theme-bg-secondary border border-theme-border-primary">
        <h3 className="text-sm font-medium text-theme-text-primary mb-4">
          Top Reporters
        </h3>
        {!stats?.topReporters?.length ? (
          <p className="text-sm text-theme-text-tertiary">No data yet</p>
        ) : (
          <div className="space-y-2">
            {stats.topReporters.slice(0, 5).map((reporter) => (
              <div
                key={reporter.id}
                className="flex items-center justify-between p-3 rounded bg-theme-bg-tertiary"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={reporter.avatarAsset?.url || undefined}
                    alt=""
                    className="w-8 h-8 rounded-full"
                  />
                  <div>
                    <p className="text-sm text-theme-text-primary">
                      @{reporter.username}/{reporter.discriminator}
                    </p>
                    <p className="text-xs text-theme-text-tertiary">
                      {reporter.validReports} valid / {reporter.falseReports}{" "}
                      false
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "text-sm font-medium",
                    reporter.reportAccuracy !== null &&
                      reporter.reportAccuracy >= 0.8
                      ? "text-green-400"
                      : reporter.reportAccuracy !== null &&
                        reporter.reportAccuracy < 0.5
                      ? "text-red-400"
                      : "text-theme-text-primary"
                  )}
                >
                  {reporter.reportAccuracy !== null
                    ? `${Math.round(reporter.reportAccuracy * 100)}%`
                    : "N/A"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Reports */}
      <div className="p-5 rounded-lg bg-theme-bg-secondary border border-theme-border-primary">
        <h3 className="text-sm font-medium text-theme-text-primary mb-4 flex items-center gap-2">
          <Flag className="w-4 h-4" />
          Recent Reports
        </h3>
        {!stats?.recentReports?.length ? (
          <p className="text-sm text-theme-text-tertiary">No recent reports</p>
        ) : (
          <div className="space-y-2">
            {stats.recentReports.map((report) => (
              <div
                key={report.id}
                className="flex items-center justify-between p-3 rounded bg-theme-bg-tertiary"
              >
                <div>
                  <p className="text-sm text-theme-text-primary capitalize">
                    {report.category.replace(/_/g, " ").toLowerCase()} (
                    {report.targetType})
                  </p>
                  <p className="text-xs text-theme-text-tertiary">
                    by @{report.reporter.username}#
                    {report.reporter.discriminator} •{" "}
                    {new Date(report.createdAt).toLocaleString()}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded",
                    report.status === "PENDING"
                      ? "bg-yellow-500/10 text-yellow-400"
                      : report.status === "REVIEWING"
                      ? "bg-blue-500/10 text-blue-400"
                      : report.status === "ACTION_TAKEN"
                      ? "bg-red-500/10 text-red-400"
                      : "bg-gray-500/10 text-gray-400"
                  )}
                >
                  {report.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
