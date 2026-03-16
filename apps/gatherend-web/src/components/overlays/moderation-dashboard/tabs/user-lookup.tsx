"use client";

import { useState } from "react";
import {
  Search,
  Loader2,
  User,
  Flag,
  AlertTriangle,
  Calendar,
  Hash,
  Ban,
  UserCheck,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

interface ModerationProfile {
  id: string;
  username: string;
  discriminator: string | null;
  avatarAsset: ClientUploadedAsset | null;
}

interface UserLookupResult {
  profile: ModerationProfile & {
    userId: string;
    banned: boolean;
    bannedAt: string | null;
    banReason: string | null;
    validReports: number;
    falseReports: number;
    reportAccuracy: number | null;
    createdAt: string;
    updatedAt: string;
  };
  stats: {
    totalReportsFiled: number;
    totalReportsAgainst: number;
    totalStrikes: number;
    activeStrikes: number;
    boardsOwned: number;
    totalMessages: number;
    accountAge: number;
  };
  reportsFiled: Array<{
    id: string;
    targetType: string;
    targetId: string;
    category: string;
    status: string;
    createdAt: string;
  }>;
  reportsAgainst: Array<{
    id: string;
    category: string;
    status: string;
    createdAt: string;
    targetType: string;
    reporter: ModerationProfile | null;
  }>;
  strikes: Array<{
    id: string;
    reason: string;
    severity: string;
    createdAt: string;
    expiresAt: string | null;
    contentType: string;
  }>;
  boardsOwned: Array<{
    id: string;
    name: string;
    imageAsset: ClientUploadedAsset | null;
    reportCount: number;
    hiddenFromFeed: boolean;
    createdAt: string;
    _count: { members: number };
  }>;
}

interface SearchProfile extends ModerationProfile {
  userId: string;
  banned: boolean;
  createdAt: string;
}

export const UserLookupTab = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchProfile[]>([]);
  const [result, setResult] = useState<UserLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setSearchResults([]);

    try {
      const res = await fetch(
        `/api/moderation/lookup?q=${encodeURIComponent(searchQuery.trim())}`
      );
      if (!res.ok) {
        if (res.status === 404) {
          setError("User not found");
        } else {
          setError("Failed to search");
        }
        return;
      }
      const data = await res.json();

      if (data.profiles.length === 0) {
        setError("No users found");
        return;
      }

      // If exact match (username/discriminator), load details directly
      if (data.exact && data.profiles.length === 1) {
        await loadUserDetails(data.profiles[0].id);
      } else {
        setSearchResults(data.profiles);
      }
    } catch {
      setError("Failed to search");
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserDetails = async (profileId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/moderation/users/${profileId}`);
      if (!res.ok) {
        setError("Failed to load user details");
        return;
      }
      const data = await res.json();
      setResult(data);
      setSearchResults([]);
    } catch {
      setError("Failed to load user details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (
    action: "ban" | "unban" | "clearStrikes",
    reason?: string
  ) => {
    if (!result) return;

    const actionMessages = {
      ban: "Are you sure you want to ban this user?",
      unban: "Are you sure you want to unban this user?",
      clearStrikes: "Are you sure you want to clear all strikes for this user?",
    };

    if (!confirm(actionMessages[action])) return;

    setActionLoading(action);
    try {
      const res = await fetch(
        `/api/moderation/users/${result.profile.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reason }),
        }
      );

      if (res.ok) {
        // Refresh the user data
        await loadUserDetails(result.profile.id);
      }
    } catch {
      // Silent fail
    } finally {
      setActionLoading(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "text-red-500 bg-red-500/10";
      case "HIGH":
        return "text-orange-500 bg-orange-500/10";
      case "MEDIUM":
        return "text-yellow-500 bg-yellow-500/10";
      default:
        return "text-gray-400 bg-gray-500/10";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-theme-text-primary">
          User Lookup
        </h1>
        <p className="text-sm text-theme-text-subtle mt-1">
          Search by username or username/discriminator for exact match
        </p>
      </div>

      {/* Search Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search username or username/1234"
            className="w-full pl-10 pr-4 py-2.5 rounded-md bg-theme-bg-input border border-theme-border-primary text-sm text-theme-text-primary placeholder:text-theme-text-tertiary focus:outline-none focus:ring-2 focus:ring-red-500/30"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={isLoading || !searchQuery.trim()}
          className="px-4 py-2 rounded-md bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Search Results List */}
      {searchResults.length > 0 && !result && (
        <div className="space-y-3">
          <p className="text-sm text-theme-text-subtle">
            Found {searchResults.length} user
            {searchResults.length !== 1 ? "s" : ""}
          </p>
          {searchResults.map((profile) => (
            <button
              key={profile.id}
              onClick={() => loadUserDetails(profile.userId)}
              className="w-full p-4 rounded-lg bg-theme-bg-secondary border border-theme-border-primary hover:bg-theme-bg-tertiary transition text-left"
            >
              <div className="flex items-center gap-3">
                <img
                  src={profile.avatarAsset?.url || undefined}
                  alt=""
                  className={cn(
                    "w-10 h-10 rounded-full",
                    profile.banned && "opacity-50 grayscale"
                  )}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-theme-text-primary">
                      @{profile.username}/{profile.discriminator}
                    </span>
                    {profile.banned && (
                      <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                        BANNED
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-theme-text-tertiary">
                    Joined {new Date(profile.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detailed Result */}
      {result && (
        <div className="space-y-6">
          {/* User Profile Card */}
          <div className="p-5 rounded-lg bg-theme-bg-secondary border border-theme-border-primary">
            <div className="flex items-start gap-4">
              <img
                src={result.profile.avatarAsset?.url || undefined}
                alt=""
                className={cn(
                  "w-16 h-16 rounded-full",
                  result.profile.banned && "opacity-50 grayscale"
                )}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-theme-text-primary">
                    @{result.profile.username}/{result.profile.discriminator}
                  </h2>
                  {result.profile.banned && (
                    <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                      BANNED
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-theme-text-tertiary">
                  <span className="flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    {result.profile.id}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Account age: {result.stats.accountAge} days
                  </span>
                </div>
                {result.profile.banned && result.profile.banReason && (
                  <p className="text-sm text-red-400 mt-2">
                    Ban reason: {result.profile.banReason}
                  </p>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 mt-4">
                  {result.profile.banned ? (
                    <button
                      onClick={() => handleAction("unban")}
                      disabled={actionLoading === "unban"}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-green-500/10 hover:bg-green-500/20 transition text-green-400"
                    >
                      {actionLoading === "unban" ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <UserCheck className="w-3 h-3" />
                      )}
                      Unban User
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        handleAction("ban", "Banned via moderation dashboard")
                      }
                      disabled={actionLoading === "ban"}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-red-500/10 hover:bg-red-500/20 transition text-red-400"
                    >
                      {actionLoading === "ban" ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Ban className="w-3 h-3" />
                      )}
                      Ban User
                    </button>
                  )}
                  {result.strikes.length > 0 && (
                    <button
                      onClick={() => handleAction("clearStrikes")}
                      disabled={actionLoading === "clearStrikes"}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-yellow-500/10 hover:bg-yellow-500/20 transition text-yellow-400"
                    >
                      {actionLoading === "clearStrikes" ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      Clear Strikes
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-theme-border-primary">
              <div className="text-center">
                <p className="text-xl font-bold text-theme-text-primary">
                  {result.stats.totalReportsAgainst}
                </p>
                <p className="text-xs text-theme-text-tertiary">
                  Reports Against
                </p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-theme-text-primary">
                  {result.stats.activeStrikes}
                </p>
                <p className="text-xs text-theme-text-tertiary">
                  Active Strikes
                </p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-theme-text-primary">
                  {result.stats.boardsOwned}
                </p>
                <p className="text-xs text-theme-text-tertiary">Boards</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-theme-text-primary">
                  {result.profile.reportAccuracy !== null
                    ? `${Math.round(result.profile.reportAccuracy * 100)}%`
                    : "N/A"}
                </p>
                <p className="text-xs text-theme-text-tertiary">
                  Report Accuracy
                </p>
              </div>
            </div>
          </div>

          {/* Strikes */}
          <div className="p-5 rounded-lg bg-theme-bg-secondary border border-theme-border-primary">
            <h3 className="text-sm font-medium text-theme-text-primary mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              Strikes ({result.strikes.length})
            </h3>
            {result.strikes.length === 0 ? (
              <p className="text-sm text-theme-text-tertiary">No strikes</p>
            ) : (
              <div className="space-y-2">
                {result.strikes.map((strike) => (
                  <div
                    key={strike.id}
                    className="flex items-center justify-between p-3 rounded bg-theme-bg-tertiary"
                  >
                    <div>
                      <p className="text-sm text-theme-text-primary">
                        {strike.reason}
                      </p>
                      <p className="text-xs text-theme-text-tertiary">
                        {strike.contentType} •{" "}
                        {new Date(strike.createdAt).toLocaleDateString()}
                        {strike.expiresAt &&
                          ` • Expires: ${new Date(
                            strike.expiresAt
                          ).toLocaleDateString()}`}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded",
                        getSeverityColor(strike.severity)
                      )}
                    >
                      {strike.severity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Reports Against */}
          <div className="p-5 rounded-lg bg-theme-bg-secondary border border-theme-border-primary">
            <h3 className="text-sm font-medium text-theme-text-primary mb-3 flex items-center gap-2">
              <Flag className="w-4 h-4 text-red-400" />
              Reports Against ({result.reportsAgainst.length})
            </h3>
            {result.reportsAgainst.length === 0 ? (
              <p className="text-sm text-theme-text-tertiary">No reports</p>
            ) : (
              <div className="space-y-2">
                {result.reportsAgainst.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-3 rounded bg-theme-bg-tertiary"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={report.reporter?.avatarAsset?.url || undefined}
                        alt=""
                        className="w-6 h-6 rounded-full"
                      />
                      <div>
                        <p className="text-sm text-theme-text-primary capitalize">
                          {report.category.replace(/_/g, " ").toLowerCase()} (
                          {report.targetType})
                        </p>
                        <p className="text-xs text-theme-text-tertiary">
                          by @{report.reporter?.username || "unknown"}/
                          {report.reporter?.discriminator || "unknown"} •{" "}
                          {new Date(report.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded",
                        report.status === "PENDING"
                          ? "bg-yellow-500/10 text-yellow-400"
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

          {/* Boards Owned */}
          <div className="p-5 rounded-lg bg-theme-bg-secondary border border-theme-border-primary">
            <h3 className="text-sm font-medium text-theme-text-primary mb-3">
              Boards Owned ({result.boardsOwned.length})
            </h3>
            {result.boardsOwned.length === 0 ? (
              <p className="text-sm text-theme-text-tertiary">No boards</p>
            ) : (
              <div className="space-y-2">
                {result.boardsOwned.map((board) => (
                  <div
                    key={board.id}
                    className="flex items-center justify-between p-3 rounded bg-theme-bg-tertiary"
                  >
                    <div className="flex items-center gap-3">
                      {board.imageAsset?.url && (
                        <img
                          src={board.imageAsset.url}
                          alt=""
                          className="w-8 h-8 rounded object-cover"
                        />
                      )}
                      <div>
                        <p className="text-sm text-theme-text-primary">
                          {board.name}
                          {board.hiddenFromFeed && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400">
                              Hidden
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-theme-text-tertiary">
                          {board._count.members} members • Created{" "}
                          {new Date(board.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {board.reportCount > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400">
                        {board.reportCount} reports
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reports Filed by User */}
          <div className="p-5 rounded-lg bg-theme-bg-secondary border border-theme-border-primary">
            <h3 className="text-sm font-medium text-theme-text-primary mb-3">
              Reports Filed ({result.reportsFiled.length})
              {result.profile.validReports + result.profile.falseReports >
                0 && (
                <span className="ml-2 text-xs font-normal text-theme-text-tertiary">
                  {result.profile.validReports} valid /{" "}
                  {result.profile.falseReports} false
                </span>
              )}
            </h3>
            {result.reportsFiled.length === 0 ? (
              <p className="text-sm text-theme-text-tertiary">
                No reports filed
              </p>
            ) : (
              <div className="space-y-2">
                {result.reportsFiled.map((report) => (
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
                        {new Date(report.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded",
                        report.status === "PENDING"
                          ? "bg-yellow-500/10 text-yellow-400"
                          : report.status === "ACTION_TAKEN"
                          ? "bg-green-500/10 text-green-400"
                          : report.status === "DISMISSED"
                          ? "bg-gray-500/10 text-gray-400"
                          : "bg-blue-500/10 text-blue-400"
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
      )}
    </div>
  );
};
