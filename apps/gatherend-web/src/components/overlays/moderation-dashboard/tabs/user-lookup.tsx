"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Ban,
  Loader2,
  Search,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  banUser,
  clearUserStrikes,
  fetchUserActions,
  fetchUserReports,
  fetchUserStrikes,
  fetchUserSummary,
  fetchUserWarnings,
  flattenCursorPages,
  formatReportTargetType,
  getReportStatusColor,
  invalidateModerationDashboardQueries,
  lookupProfiles,
  removeStrike,
  removeWarning,
  strikeUser,
  unbanUser,
  warnUser,
  type LookupResponse,
} from "../lib";

const HEADER_PANEL_SHELL =
  "border border-theme-border bg-theme-bg-overlay-primary/78 px-4 pt-4 pb-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.26)] sm:px-5 sm:py-5";
const PANEL_CLASS =
  "border border-theme-border bg-theme-bg-overlay-primary/50 p-4";
const ITEM_ROW_CLASS =
  "flex min-h-10 items-center gap-3 rounded-none border border-theme-border-subtle bg-theme-bg-edit-form/50 px-3 py-1";
const actionButtonClass =
  "h-6.5 min-w-[120px] cursor-pointer rounded-none bg-theme-tab-button-bg px-3 text-[14px] text-theme-text-light transition hover:bg-theme-tab-button-hover";
const subtleButtonClass =
  "cursor-pointer rounded-none border border-theme-border bg-theme-bg-secondary/35 px-2.5 py-1.5 text-theme-text-subtle transition hover:text-theme-text-light disabled:opacity-50";
const metaBadgeClass =
  "inline-flex items-center rounded-none border border-theme-border bg-theme-bg-secondary/35 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-theme-text-muted";

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className={PANEL_CLASS}>
      <p className="text-xs uppercase tracking-[0.08em] text-theme-text-muted">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-theme-text-primary">{value}</p>
      {helper && <p className="mt-1 text-[11px] text-theme-text-muted">{helper}</p>}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-theme-text-muted">
          {title}
        </h3>
        {typeof count === "number" && (
          <span className={metaBadgeClass}>{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function LoadMoreButton({
  show,
  loading,
  onClick,
  label,
}: {
  show: boolean;
  loading: boolean;
  onClick: () => void;
  label: string;
}) {
  if (!show) return null;

  return (
    <div className="flex justify-center pt-2">
      <Button onClick={onClick} className={actionButtonClass} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
      </Button>
    </div>
  );
}

export const UserLookupTab = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<LookupResponse["profiles"]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const searchMutation = useMutation({
    mutationFn: (query: string) => lookupProfiles(query),
    onSuccess: (data) => {
      setSearchError(null);
      if (data.exact && data.profiles.length === 1) {
        setSelectedProfileId(data.profiles[0].id);
        setSearchResults([]);
        return;
      }

      setSelectedProfileId(null);
      setSearchResults(data.profiles);

      if (data.profiles.length === 0) {
        setSearchError("No users found");
      }
    },
    onError: () => {
      setSearchResults([]);
      setSearchError("Failed to search users");
    },
  });

  const summaryQuery = useQuery({
    queryKey: ["moderation", "user-summary", selectedProfileId],
    queryFn: () => fetchUserSummary(selectedProfileId!),
    enabled: !!selectedProfileId,
  });

  const warningsQuery = useInfiniteQuery({
    queryKey: ["moderation", "user-warnings", selectedProfileId],
    queryFn: ({ pageParam }: { pageParam?: string | null }) =>
      fetchUserWarnings(selectedProfileId!, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled: !!selectedProfileId,
  });

  const strikesQuery = useInfiniteQuery({
    queryKey: ["moderation", "user-strikes", selectedProfileId],
    queryFn: ({ pageParam }: { pageParam?: string | null }) =>
      fetchUserStrikes(selectedProfileId!, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled: !!selectedProfileId,
  });

  const actionsQuery = useInfiniteQuery({
    queryKey: ["moderation", "user-actions", selectedProfileId],
    queryFn: ({ pageParam }: { pageParam?: string | null }) =>
      fetchUserActions(selectedProfileId!, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled: !!selectedProfileId,
  });

  const reportsQuery = useInfiniteQuery({
    queryKey: ["moderation", "user-reports", selectedProfileId],
    queryFn: ({ pageParam }: { pageParam?: string | null }) =>
      fetchUserReports(selectedProfileId!, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled: !!selectedProfileId,
  });

  const warnings = flattenCursorPages(warningsQuery.data);
  const strikes = flattenCursorPages(strikesQuery.data);
  const actions = flattenCursorPages(actionsQuery.data);
  const reports = flattenCursorPages(reportsQuery.data);

  const runMutation = async (fn: () => Promise<unknown>) => {
    if (!selectedProfileId) return;
    await fn();
    await invalidateModerationDashboardQueries(queryClient, selectedProfileId);
  };

  const banMutation = useMutation({
    mutationFn: ({ profileId, reason }: { profileId: string; reason?: string }) =>
      banUser(profileId, reason),
    onSuccess: async () => {
      await invalidateModerationDashboardQueries(queryClient, selectedProfileId);
      toast.success("User banned");
    },
    onError: (error: unknown) => {
      console.error(error);
      toast.error("Failed to ban user");
    },
  });

  const unbanMutation = useMutation({
    mutationFn: (profileId: string) => unbanUser(profileId),
    onSuccess: async () => {
      await invalidateModerationDashboardQueries(queryClient, selectedProfileId);
      toast.success(t.moderation.unbanSuccess);
    },
    onError: (error: unknown) => {
      console.error(error);
      toast.error(t.moderation.unbanError);
    },
  });

  const warningMutation = useMutation({
    mutationFn: ({ profileId, reason }: { profileId: string; reason: string }) =>
      warnUser(profileId, reason),
    onSuccess: async () => {
      await invalidateModerationDashboardQueries(queryClient, selectedProfileId);
      toast.success("Warning issued");
    },
    onError: (error: unknown) => {
      console.error(error);
      toast.error("Failed to issue warning");
    },
  });

  const strikeMutation = useMutation({
    mutationFn: ({ profileId, reason }: { profileId: string; reason: string }) =>
      strikeUser(profileId, reason),
    onSuccess: async () => {
      await invalidateModerationDashboardQueries(queryClient, selectedProfileId);
      toast.success("Strike issued");
    },
    onError: (error: unknown) => {
      console.error(error);
      toast.error("Failed to issue strike");
    },
  });

  const clearStrikesMutation = useMutation({
    mutationFn: (profileId: string) => clearUserStrikes(profileId),
    onSuccess: async () => {
      await invalidateModerationDashboardQueries(queryClient, selectedProfileId);
      toast.success("Direct strikes cleared");
    },
    onError: (error: unknown) => {
      console.error(error);
      toast.error("Failed to clear direct strikes");
    },
  });

  const removeWarningMutation = useMutation({
    mutationFn: (warningId: string) => removeWarning(warningId),
    onSuccess: async () => {
      await invalidateModerationDashboardQueries(queryClient, selectedProfileId);
      toast.success("Warning removed");
    },
    onError: (error: unknown) => {
      console.error(error);
      toast.error("Failed to remove warning");
    },
  });

  const removeStrikeMutation = useMutation({
    mutationFn: (strikeId: string) => removeStrike(strikeId),
    onSuccess: async () => {
      await invalidateModerationDashboardQueries(queryClient, selectedProfileId);
      toast.success("Strike removed");
    },
    onError: (error: unknown) => {
      console.error(error);
      toast.error("Failed to remove strike");
    },
  });

  const handleSearch = () => {
    const normalized = searchQuery.trim();
    if (!normalized) return;
    searchMutation.mutate(normalized);
  };

  const handleBan = () => {
    if (!selectedProfileId) return;
    const reason = window.prompt("Optional ban reason");
    if (reason === null) return;
    banMutation.mutate({ profileId: selectedProfileId, reason });
  };

  const handleUnban = () => {
    if (!selectedProfileId) return;
    if (!window.confirm("Unban this user?")) return;
    unbanMutation.mutate(selectedProfileId);
  };

  const handleWarn = () => {
    if (!selectedProfileId) return;
    const reason = window.prompt("Why are you issuing this warning?");
    if (!reason?.trim()) return;
    warningMutation.mutate({ profileId: selectedProfileId, reason: reason.trim() });
  };

  const handleStrike = () => {
    if (!selectedProfileId) return;
    const reason = window.prompt("Why are you issuing this strike?");
    if (!reason?.trim()) return;
    strikeMutation.mutate({ profileId: selectedProfileId, reason: reason.trim() });
  };

  const handleClearStrikes = () => {
    if (!selectedProfileId) return;
    if (!window.confirm("Clear all direct strikes for this user?")) return;
    clearStrikesMutation.mutate(selectedProfileId);
  };

  const summary = summaryQuery.data;

  return (
    <div className="space-y-6">
      <div className={HEADER_PANEL_SHELL}>
        <div className="-mb-3 -mt-3 border-b border-theme-border pb-0.5">
          <div>
            <h2 className="text-2xl font-bold text-theme-text-primary">
              {t.moderation.userLookup}
            </h2>
            <p className="-mt-1 text-sm text-theme-text-tertiary">
              Search a user and manage warnings, strikes, bans, and review history.
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
            placeholder="Search username or username/1234"
            className="w-full rounded-none border border-theme-border bg-theme-bg-input py-2.5 pl-10 pr-4 text-sm text-theme-text-primary placeholder:text-theme-text-tertiary focus:outline-none focus:ring-2 focus:ring-red-500/30"
          />
        </div>
        <Button
          onClick={handleSearch}
          className={actionButtonClass}
          disabled={searchMutation.isPending || !searchQuery.trim()}
        >
          {searchMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Search"
          )}
        </Button>
      </div>

      {searchError && (
        <div className="border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-400">
          {searchError}
        </div>
      )}

      {searchResults.length > 0 && !selectedProfileId && (
        <div className="space-y-3">
          {searchResults.map((profile) => (
            <button
              key={profile.id}
              onClick={() => {
                setSelectedProfileId(profile.id);
                setSearchResults([]);
              }}
              className={cn(PANEL_CLASS, "w-full text-left transition hover:bg-theme-bg-secondary/40")}
            >
              <div className="flex items-center gap-3">
                <UserAvatar
                  src={profile.avatarAsset?.url || ""}
                  profileId={profile.id}
                  showStatus={false}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-theme-text-primary">
                    @{profile.username}
                    {profile.discriminator ? `/${profile.discriminator}` : ""}
                  </p>
                  <p className="mt-1 text-[11px] text-theme-text-muted">
                    Created on {new Date(profile.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {profile.banned && <span className={metaBadgeClass}>{t.moderation.ban}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {summaryQuery.isLoading && selectedProfileId ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-theme-text-tertiary" />
        </div>
      ) : summary ? (
        <div className="space-y-6">
          <div className={PANEL_CLASS}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar
                  src={summary.profile.avatarAsset?.url || ""}
                  profileId={summary.profile.id}
                  showStatus={false}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-lg font-semibold text-theme-text-primary">
                      @{summary.profile.username}
                      {summary.profile.discriminator
                        ? `/${summary.profile.discriminator}`
                        : ""}
                    </p>
                    {summary.profile.banned && (
                      <span className={metaBadgeClass}>{t.moderation.ban}</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-theme-text-muted">
                    <span>Reputation: {summary.profile.reputationScore ?? 0}</span>
                    <span>
                      Accuracy:{" "}
                      {summary.profile.reportAccuracy !== null
                        ? `${Math.round(summary.profile.reportAccuracy * 100)}%`
                        : "N/A"}
                    </span>
                    <span>
                      Created {new Date(summary.profile.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {summary.profile.banned ? (
                  <Button
                    onClick={handleUnban}
                    className={actionButtonClass}
                    disabled={unbanMutation.isPending}
                  >
                    <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                    {t.moderation.unban}
                  </Button>
                ) : (
                  <Button
                    onClick={handleBan}
                    className={cn(actionButtonClass, "bg-red-600 hover:bg-red-500")}
                    disabled={banMutation.isPending}
                  >
                    <Ban className="mr-1.5 h-3.5 w-3.5" />
                    {t.moderation.ban}
                  </Button>
                )}
                <Button
                  onClick={handleWarn}
                  className={cn(actionButtonClass, "bg-yellow-600 hover:bg-yellow-500")}
                  disabled={warningMutation.isPending}
                >
                  {t.moderation.warn}
                </Button>
                <Button
                  onClick={handleStrike}
                  className={cn(actionButtonClass, "bg-orange-600 hover:bg-orange-500")}
                  disabled={strikeMutation.isPending}
                >
                  {t.moderation.strike}
                </Button>
                <Button
                  onClick={handleClearStrikes}
                  className={actionButtonClass}
                  disabled={
                    clearStrikesMutation.isPending ||
                    summary.stats.strikeStats.direct === 0
                  }
                >
                  {t.moderation.clearStrikes}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Active warnings"
              value={summary.stats.warningStats.active}
              helper={`${summary.stats.warningStats.promoted} promoted • ${summary.stats.warningStats.removed} removed`}
            />
            <SummaryCard
              label="Active strikes"
              value={summary.stats.strikeStats.active}
              helper={`${summary.stats.strikeStats.direct} direct • ${summary.stats.strikeStats.warningEscalation} from warnings`}
            />
            <SummaryCard
              label="Reports"
              value={summary.stats.totalReportsAgainst}
              helper={`${summary.stats.totalReportsFiled} filed by this user`}
            />
            <SummaryCard
              label="Account"
              value={`${summary.stats.accountAge}d`}
              helper={`${summary.stats.totalMessages} messages • ${summary.stats.boardsOwned} boards owned`}
            />
          </div>

          <Section title="Warnings" count={warnings.length}>
            {!warnings.length ? (
              <div className={PANEL_CLASS}>
                <p className="text-sm text-theme-text-muted">No warnings for this user.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {warnings.map((warning) => (
                  <div key={warning.id} className={ITEM_ROW_CLASS}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-theme-text-primary">
                        <span className={metaBadgeClass}>{warning.status}</span>
                        <span className="truncate">{warning.reason}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-theme-text-muted">
                        <span>By @{warning.issuedBy?.username || "unknown"}</span>
                        <span>{new Date(warning.createdAt).toLocaleString()}</span>
                        {warning.report && (
                          <span>
                            {warning.report.category.replace(/_/g, " ").toLowerCase()}
                          </span>
                        )}
                      </div>
                      {warning.notes && (
                        <p className="mt-1 text-[11px] text-theme-text-muted">
                          {warning.notes}
                        </p>
                      )}
                    </div>
                    {warning.status !== "REMOVED" && (
                      <Button
                        onClick={() => removeWarningMutation.mutate(warning.id)}
                        className={actionButtonClass}
                        disabled={removeWarningMutation.isPending}
                      >
                        {t.moderation.removeWarning}
                      </Button>
                    )}
                  </div>
                ))}
                <LoadMoreButton
                  show={!!warningsQuery.hasNextPage}
                  loading={warningsQuery.isFetchingNextPage}
                  onClick={() => warningsQuery.fetchNextPage()}
                  label={t.discovery.loadMore}
                />
              </div>
            )}
          </Section>

          <Section title="Strikes" count={strikes.length}>
            {!strikes.length ? (
              <div className={PANEL_CLASS}>
                <p className="text-sm text-theme-text-muted">No strikes for this user.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {strikes.map((strike) => {
                  const removable = strike.sourceType !== "WARNING_ESCALATION";
                  return (
                    <div key={strike.id} className={ITEM_ROW_CLASS}>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-theme-text-primary">
                          <span className={metaBadgeClass}>{strike.severity}</span>
                          <span className={metaBadgeClass}>
                            {strike.sourceType || "DIRECT"}
                          </span>
                          <span className="truncate">{strike.reason}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-theme-text-muted">
                          <span>{new Date(strike.createdAt).toLocaleString()}</span>
                          {strike.originReport && (
                            <span>
                              {strike.originReport.category
                                .replace(/_/g, " ")
                                .toLowerCase()}
                            </span>
                          )}
                        </div>
                        {!removable && (
                          <p className="mt-1 text-[11px] text-theme-text-muted">
                            Remove one of the source warnings to reverse this strike.
                          </p>
                        )}
                      </div>
                      {removable && (
                        <Button
                          onClick={() => removeStrikeMutation.mutate(strike.id)}
                          className={actionButtonClass}
                          disabled={removeStrikeMutation.isPending}
                        >
                          {t.moderation.removeStrike}
                        </Button>
                      )}
                    </div>
                  );
                })}
                <LoadMoreButton
                  show={!!strikesQuery.hasNextPage}
                  loading={strikesQuery.isFetchingNextPage}
                  onClick={() => strikesQuery.fetchNextPage()}
                  label={t.discovery.loadMore}
                />
              </div>
            )}
          </Section>

          <Section title="Recent actions" count={actions.length}>
            {!actions.length ? (
              <div className={PANEL_CLASS}>
                <p className="text-sm text-theme-text-muted">
                  No moderation actions for this user yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {actions.map((action) => (
                  <div key={action.id} className={ITEM_ROW_CLASS}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-theme-text-primary">
                        <span className={metaBadgeClass}>{action.actionType}</span>
                        <span className="truncate">
                          By @{action.issuedBy?.username || "unknown"}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-theme-text-muted">
                        <span>{new Date(action.createdAt).toLocaleString()}</span>
                        {action.warning && <span>{action.warning.status}</span>}
                        {action.strike && <span>{action.strike.severity}</span>}
                      </div>
                      {action.notes && (
                        <p className="mt-1 text-[11px] text-theme-text-muted">
                          {action.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                <LoadMoreButton
                  show={!!actionsQuery.hasNextPage}
                  loading={actionsQuery.isFetchingNextPage}
                  onClick={() => actionsQuery.fetchNextPage()}
                  label={t.discovery.loadMore}
                />
              </div>
            )}
          </Section>

          <Section title="Reports" count={reports.length}>
            {!reports.length ? (
              <div className={PANEL_CLASS}>
                <p className="text-sm text-theme-text-muted">No reports linked to this user.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => (
                  <div key={report.id} className={ITEM_ROW_CLASS}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-theme-text-primary">
                        <span className={metaBadgeClass}>
                          {report.relationType || "ALL"}
                        </span>
                        <span className={metaBadgeClass}>
                          {formatReportTargetType(report.targetType)}
                        </span>
                        <span
                          className={cn(
                            "text-[11px] font-medium uppercase tracking-[0.05em]",
                            getReportStatusColor(report.status),
                          )}
                        >
                          {report.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-theme-text-primary">
                        {report.description || report.snapshot.content || "No report note"}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-theme-text-muted">
                        <span>{new Date(report.createdAt).toLocaleString()}</span>
                        <span>{report.category.replace(/_/g, " ").toLowerCase()}</span>
                      </div>
                    </div>
                  </div>
                ))}
                <LoadMoreButton
                  show={!!reportsQuery.hasNextPage}
                  loading={reportsQuery.isFetchingNextPage}
                  onClick={() => reportsQuery.fetchNextPage()}
                  label={t.discovery.loadMore}
                />
              </div>
            )}
          </Section>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-1 text-center">
          <ShieldAlert className="mb-3 h-12 w-12 text-theme-text-muted" />
          <p className="text-md font-medium text-theme-text-tertiary">
            {t.moderation.userLookup}
          </p>
          <p className="mt-1 text-sm text-theme-text-muted">
            Search for a user to review warnings, strikes, reports, and ban state.
          </p>
        </div>
      )}
    </div>
  );
};
