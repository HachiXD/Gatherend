"use client";

import { AlertTriangle, Ban, Flag, Loader2, RefreshCw, ScrollText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { fetchStats } from "../lib";

const HEADER_PANEL_SHELL =
  "border border-theme-border bg-theme-bg-overlay-primary/78 px-4 pt-4 pb-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.26)] sm:px-5 sm:py-5";
const PANEL_CLASS =
  "border border-theme-border bg-theme-bg-overlay-primary/50 p-4";
const ROW_CLASS =
  "flex min-h-10 items-center gap-3 rounded-none border border-theme-border-subtle bg-theme-bg-edit-form/50 px-3 py-1";
const actionButtonClass =
  "h-6.5 min-w-[120px] cursor-pointer rounded-none bg-theme-tab-button-bg px-3 text-[14px] text-theme-text-light transition hover:bg-theme-tab-button-hover";
const metaBadgeClass =
  "inline-flex items-center rounded-none border border-theme-border bg-theme-bg-secondary/35 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-theme-text-muted";

function StatCard({
  label,
  value,
  helper,
  accentClass,
}: {
  label: string;
  value: string | number;
  helper?: string;
  accentClass?: string;
}) {
  return (
    <div className={PANEL_CLASS}>
      <p className="text-xs uppercase tracking-[0.08em] text-theme-text-muted">
        {label}
      </p>
      <p className={cn("mt-2 text-2xl font-bold text-theme-text-primary", accentClass)}>
        {value}
      </p>
      {helper && <p className="mt-1 text-[11px] text-theme-text-muted">{helper}</p>}
    </div>
  );
}

export const StatsTab = () => {
  const { t } = useTranslation();
  const { data: stats, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["moderation", "stats"],
    queryFn: fetchStats,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-theme-text-tertiary" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-1 text-center">
        <ScrollText className="mb-3 h-12 w-12 text-theme-text-muted" />
        <p className="text-md font-medium text-theme-text-tertiary">No moderation stats yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={HEADER_PANEL_SHELL}>
        <div className="-mb-3 -mt-3 border-b border-theme-border pb-0.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-theme-text-primary">
                {t.moderation.stats}
              </h2>
              <p className="-mt-1 text-sm text-theme-text-tertiary">
                Snapshot of unresolved work, enforcement, and recent moderation activity.
              </p>
            </div>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="cursor-pointer rounded-none border border-theme-border bg-theme-bg-secondary/35 p-2 text-theme-text-subtle transition hover:text-theme-text-light disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pending reports"
          value={stats.overview.pendingReports}
          helper={`${stats.overview.reviewingReports} reviewing`}
        />
        <StatCard
          label="Reports this week"
          value={stats.overview.reportsThisWeek}
          helper={`${stats.overview.reportsToday} today`}
        />
        <StatCard
          label="Active warnings"
          value={stats.overview.activeWarnings}
          helper={`${stats.overview.promotedWarnings} promoted • ${stats.overview.removedWarnings} removed`}
        />
        <StatCard
          label="Banned users"
          value={stats.overview.bannedUsers}
          helper={`${stats.overview.autoBannedUsers} auto-bans`}
          accentClass="text-red-400"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Active strikes"
          value={stats.overview.activeStrikes}
          helper={`${stats.overview.directStrikes} direct • ${stats.overview.warningEscalationStrikes} warning escalation`}
        />
        <StatCard
          label="Total reports"
          value={stats.overview.totalReports}
          helper={`${stats.overview.actionTakenReports} action taken • ${stats.overview.dismissedReports} dismissed`}
        />
        <StatCard
          label="Actions this week"
          value={stats.overview.actionsThisWeek}
          helper="All platform moderation actions"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={PANEL_CLASS}>
          <div className="mb-3 flex items-center gap-2">
            <Flag className="h-4 w-4 text-theme-text-tertiary" />
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-theme-text-muted">
              Recent reports
            </h3>
          </div>
          {!stats.recentReports.length ? (
            <p className="text-sm text-theme-text-muted">No recent reports.</p>
          ) : (
            <div className="space-y-3">
              {stats.recentReports.map((report) => (
                <div key={report.id} className={ROW_CLASS}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-theme-text-primary">
                      <span className={metaBadgeClass}>{report.targetType}</span>
                      <span
                        className={cn(
                          "text-[11px] font-medium uppercase tracking-[0.05em]",
                          report.status === "PENDING"
                            ? "text-yellow-400"
                            : report.status === "REVIEWING"
                              ? "text-blue-400"
                              : "text-theme-text-tertiary",
                        )}
                      >
                        {report.status}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-theme-text-muted">
                      <span>{report.category.replace(/_/g, " ").toLowerCase()}</span>
                      <span>@{report.reporter?.username || "unknown"}</span>
                      <span>{new Date(report.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={PANEL_CLASS}>
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-theme-text-tertiary" />
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-theme-text-muted">
              Recent actions
            </h3>
          </div>
          {!stats.recentActions.length ? (
            <p className="text-sm text-theme-text-muted">No recent actions.</p>
          ) : (
            <div className="space-y-3">
              {stats.recentActions.map((action) => (
                <div key={action.id} className={ROW_CLASS}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-theme-text-primary">
                      <span className={metaBadgeClass}>{action.actionType}</span>
                      <span className="truncate">
                        @{action.profile?.username || "unknown user"}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-theme-text-muted">
                      <span>By @{action.issuedBy?.username || "unknown"}</span>
                      <span>{new Date(action.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={PANEL_CLASS}>
          <div className="mb-3 flex items-center gap-2">
            <Ban className="h-4 w-4 text-theme-text-tertiary" />
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-theme-text-muted">
              Most reported users
            </h3>
          </div>
          {!stats.mostReportedUsers.length ? (
            <p className="text-sm text-theme-text-muted">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {stats.mostReportedUsers.slice(0, 5).map((user) => (
                <div key={user.id} className={ROW_CLASS}>
                  <UserAvatar
                    src={user.avatarAsset?.url || ""}
                    profileId={user.id}
                    showStatus={false}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-theme-text-primary">
                      <span className="truncate">
                        @{user.username}
                        {user.discriminator ? `/${user.discriminator}` : ""}
                      </span>
                      {user.banned && <span className={metaBadgeClass}>{t.moderation.ban}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-theme-text-muted">
                      <span>{user._count?.reportsAgainst ?? 0} reports</span>
                      <span>{user._count?.strikes ?? 0} strikes</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={PANEL_CLASS}>
          <div className="mb-3 flex items-center gap-2">
            <Button className={cn(actionButtonClass, "pointer-events-none h-7 min-w-0 px-2 text-[12px]")}>
              Top Reporters
            </Button>
          </div>
          {!stats.topReporters.length ? (
            <p className="text-sm text-theme-text-muted">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {stats.topReporters.slice(0, 5).map((reporter) => (
                <div key={reporter.id} className={ROW_CLASS}>
                  <UserAvatar
                    src={reporter.avatarAsset?.url || ""}
                    profileId={reporter.id}
                    showStatus={false}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-theme-text-primary">
                      @{reporter.username}
                      {reporter.discriminator ? `/${reporter.discriminator}` : ""}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-theme-text-muted">
                      <span>{reporter.validReports ?? 0} valid</span>
                      <span>{reporter.falseReports ?? 0} false</span>
                      <span>
                        {reporter.reportAccuracy !== null &&
                        reporter.reportAccuracy !== undefined
                          ? `${Math.round(reporter.reportAccuracy * 100)}% accuracy`
                          : "No accuracy data"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
