"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Flag,
  Loader2,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  User,
  Users,
} from "lucide-react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  fetchReportDetail,
  fetchReportsQueue,
  flattenCursorPages,
  formatReportTargetType,
  getPriorityColor,
  getReportStatusColor,
  invalidateModerationDashboardQueries,
  openBoardInvestigation,
  resolveReport,
  type ModerationActionItem,
  type ModerationReportDetail,
  type ModerationReportItem,
  type PlatformWarningItem,
  type StrikeItem,
} from "../lib";

const HEADER_PANEL_SHELL =
  "border border-theme-border bg-theme-bg-overlay-primary/78 px-4 pt-4 pb-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.26)] sm:px-5 sm:py-5";
const REPORT_ROW_CLASS =
  "flex min-h-10 items-center gap-3 rounded-none border border-theme-border-subtle bg-theme-bg-edit-form/50 px-3 py-1";
const actionButtonClass =
  "h-6.5 min-w-[120px] cursor-pointer rounded-none bg-theme-tab-button-bg px-3 text-[14px] text-theme-text-light transition hover:bg-theme-tab-button-hover";
const subtleButtonClass =
  "cursor-pointer rounded-none border border-theme-border bg-theme-bg-secondary/35 px-2.5 py-1.5 text-theme-text-subtle transition hover:text-theme-text-light disabled:opacity-50";
const metaBadgeClass =
  "inline-flex items-center rounded-none border border-theme-border bg-theme-bg-secondary/35 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-theme-text-muted";

function getTargetTypeIcon(type: string) {
  switch (type) {
    case "MESSAGE":
    case "DIRECT_MESSAGE":
      return <MessageSquare className="h-4 w-4" />;
    case "PROFILE":
      return <User className="h-4 w-4" />;
    case "BOARD":
    case "COMMUNITY":
      return <Users className="h-4 w-4" />;
    default:
      return <Flag className="h-4 w-4" />;
  }
}

function getPreviewText(report: ModerationReportItem) {
  return (
    report.snapshot.content ||
    report.snapshot.description ||
    report.snapshot.name ||
    report.snapshot.authorUsername ||
    report.snapshot.username ||
    report.description ||
    "No content snapshot available"
  );
}

function renderWarningSummary(warning: PlatformWarningItem) {
  return (
    <div key={warning.id} className={REPORT_ROW_CLASS}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-theme-text-primary">
          <span className={metaBadgeClass}>{warning.status}</span>
          <span className="truncate">{warning.reason}</span>
        </div>
        <p className="mt-1 text-[11px] text-theme-text-muted">
          Issued by @{warning.issuedBy?.username || "unknown"} on{" "}
          {new Date(warning.createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function renderStrikeSummary(strike: StrikeItem) {
  return (
    <div key={strike.id} className={REPORT_ROW_CLASS}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-theme-text-primary">
          <span className={metaBadgeClass}>{strike.severity}</span>
          <span className={metaBadgeClass}>{strike.sourceType || "DIRECT"}</span>
          <span className="truncate">{strike.reason}</span>
        </div>
        <p className="mt-1 text-[11px] text-theme-text-muted">
          Created on {new Date(strike.createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function renderActionSummary(action: ModerationActionItem) {
  return (
    <div key={action.id} className={REPORT_ROW_CLASS}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-theme-text-primary">
          <span className={metaBadgeClass}>{action.actionType}</span>
          <span className="truncate">
            @{action.profile?.username || "unknown user"}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-theme-text-muted">
          By @{action.issuedBy?.username || "unknown"} on{" "}
          {new Date(action.createdAt).toLocaleString()}
        </p>
        {action.notes && (
          <p className="mt-1 text-[11px] text-theme-text-muted">{action.notes}</p>
        )}
      </div>
    </div>
  );
}

interface ReportDetailViewProps {
  report: ModerationReportDetail | null;
  isLoading: boolean;
  isResolving: boolean;
  onBack: () => void;
  onResolve: (action: "dismiss" | "warning" | "strike" | "ban") => void;
  onViewBoard: (boardId: string) => void;
  onOpenInvestigation: (reportId: string) => void;
  isOpeningInvestigation: boolean;
}

function ReportDetailView({
  report,
  isLoading,
  isResolving,
  onBack,
  onResolve,
  onViewBoard,
  onOpenInvestigation,
  isOpeningInvestigation,
}: ReportDetailViewProps) {
  if (isLoading || !report) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-theme-text-tertiary" />
      </div>
    );
  }

  const canResolve =
    report.status === "PENDING" || report.status === "REVIEWING";

  return (
    <div className="space-y-6">
      <div className={HEADER_PANEL_SHELL}>
        <div className="-mb-3 -mt-3 border-b border-theme-border pb-0.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className={subtleButtonClass}>
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-theme-text-primary">
                  Review Report
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-theme-text-tertiary">
                  <span className={metaBadgeClass}>
                    {formatReportTargetType(report.targetType)}
                  </span>
                  <span
                    className={cn(
                      "rounded-none px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em]",
                      getPriorityColor(report.priority),
                    )}
                  >
                    {report.priority}
                  </span>
                  <span className={cn("text-xs", getReportStatusColor(report.status))}>
                    {report.status}
                  </span>
                  <span>{new Date(report.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {report.boardId && (
                <Button
                  onClick={() => onViewBoard(report.boardId!)}
                  className={subtleButtonClass}
                >
                  View board
                </Button>
              )}
              {report.boardId && report.targetType !== "BOARD" && (
                <Button
                  onClick={() => onOpenInvestigation(report.id)}
                  className={subtleButtonClass}
                  disabled={isOpeningInvestigation}
                >
                  {isOpeningInvestigation ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Open investigation"
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="border border-theme-border bg-theme-bg-overlay-primary/50 p-4">
          <p className="text-xs uppercase tracking-[0.08em] text-theme-text-muted">
            Reporter
          </p>
          <div className="mt-3 flex items-center gap-3">
            <UserAvatar
              src={report.reporter?.avatarAsset?.url || ""}
              profileId={report.reporter?.id}
              showStatus={false}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-theme-text-primary">
                @{report.reporter?.username || "unknown"}
                {report.reporter?.discriminator
                  ? `/${report.reporter.discriminator}`
                  : ""}
              </p>
              {report.description && (
                <p className="mt-1 text-[11px] text-theme-text-muted">
                  "{report.description}"
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="border border-theme-border bg-theme-bg-overlay-primary/50 p-4">
          <p className="text-xs uppercase tracking-[0.08em] text-theme-text-muted">
            Target owner
          </p>
          <div className="mt-3 flex items-center gap-3">
            <UserAvatar
              src={report.targetOwner?.avatarAsset?.url || ""}
              profileId={report.targetOwner?.id}
              showStatus={false}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-theme-text-primary">
                @{report.targetOwner?.username || "unknown"}
                {report.targetOwner?.discriminator
                  ? `/${report.targetOwner.discriminator}`
                  : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {report.currentBoardMetadata && (
        <div className="border border-theme-border bg-theme-bg-overlay-primary/50 p-4">
          <p className="text-xs uppercase tracking-[0.08em] text-theme-text-muted">
            Current Board Metadata
          </p>
          <div className="mt-3 flex items-start gap-3">
            {report.currentBoardMetadata.imageAsset?.url ? (
              <img
                src={report.currentBoardMetadata.imageAsset.url}
                alt=""
                className="h-16 w-16 rounded-none border border-theme-border object-cover"
              />
            ) : null}
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-semibold text-theme-text-primary">
                {report.currentBoardMetadata.name}
              </p>
              {report.currentBoardMetadata.description && (
                <p className="text-[12px] text-theme-text-muted">
                  {report.currentBoardMetadata.description}
                </p>
              )}
              <div className="flex flex-wrap gap-2 text-[11px] text-theme-text-tertiary">
                <span className={metaBadgeClass}>
                  {report.currentBoardMetadata.isPrivate ? "Private" : "Public"}
                </span>
                <span className={metaBadgeClass}>
                  Risk {report.currentBoardMetadata.riskLevel}
                </span>
                <span className={metaBadgeClass}>
                  Reports {report.currentBoardMetadata.reportCount}
                </span>
              </div>
              <p className="text-[11px] text-theme-text-muted">
                Owner: @{report.currentBoardMetadata.owner?.username || "unknown"}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="border border-theme-border bg-theme-bg-overlay-primary/50 p-4">
        <p className="text-xs uppercase tracking-[0.08em] text-theme-text-muted">
          Snapshot
        </p>
        <div className="mt-3 space-y-3 text-sm text-theme-text-primary">
          <p className="whitespace-pre-wrap">{getPreviewText(report)}</p>
          {report.snapshot.fileUrl && (
            <img
              src={report.snapshot.fileUrl}
              alt=""
              className="max-h-64 rounded-none border border-theme-border object-contain"
            />
          )}
          {report.boardId && (
            <p className="text-[11px] text-theme-text-muted">
              Board ID: {report.boardId}
            </p>
          )}
          {report.channelId && (
            <p className="text-[11px] text-theme-text-muted">
              Channel ID: {report.channelId}
            </p>
          )}
        </div>
      </div>

      {report.messageContext && report.messageContext.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-theme-text-muted">
            Message Context
          </h3>
          {report.messageContext.map((message) => (
            <div
              key={message.id}
              className={cn(
                REPORT_ROW_CLASS,
                message.isReported && "border-red-500/35 bg-red-500/5",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-theme-text-tertiary">
                  @{message.messageSender?.username || "unknown"} •{" "}
                  {new Date(message.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-theme-text-primary">
                  {message.content || "No message content"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {report.recentWarnings?.length ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-theme-text-muted">
            Recent warnings
          </h3>
          {report.recentWarnings.map(renderWarningSummary)}
        </div>
      ) : null}

      {report.recentTargetStrikes?.length ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-theme-text-muted">
            Recent strikes
          </h3>
          {report.recentTargetStrikes.map(renderStrikeSummary)}
        </div>
      ) : null}

      {report.recentPlatformActions?.length ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-theme-text-muted">
            Recent platform actions
          </h3>
          {report.recentPlatformActions.map(renderActionSummary)}
        </div>
      ) : null}

      {canResolve && (
        <div className="flex flex-wrap items-center gap-3 border-t border-theme-border pt-4">
          <Button
            onClick={() => onResolve("dismiss")}
            className={actionButtonClass}
            disabled={isResolving}
          >
            Dismiss
          </Button>
          <Button
            onClick={() => onResolve("warning")}
            className={cn(actionButtonClass, "bg-yellow-600 hover:bg-yellow-500")}
            disabled={isResolving}
          >
            Issue Warning
          </Button>
          <Button
            onClick={() => onResolve("strike")}
            className={cn(actionButtonClass, "bg-orange-600 hover:bg-orange-500")}
            disabled={isResolving}
          >
            Issue Strike
          </Button>
          <Button
            onClick={() => onResolve("ban")}
            className={cn(actionButtonClass, "bg-red-600 hover:bg-red-500")}
            disabled={isResolving}
          >
            Ban User
          </Button>
        </div>
      )}
    </div>
  );
}

interface ReportsTabProps {
  onViewBoard: (boardId: string) => void;
  onViewInvestigation: (investigationId: string) => void;
}

export const ReportsTab = ({
  onViewBoard,
  onViewInvestigation,
}: ReportsTabProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["moderation", "reports"],
    queryFn: ({ pageParam }: { pageParam?: string | null }) =>
      fetchReportsQueue(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    staleTime: 0,
  });

  const reports = flattenCursorPages(data);

  const { data: selectedReport, isLoading: isLoadingDetail } = useQuery({
    queryKey: ["moderation", "report", selectedReportId],
    queryFn: () => fetchReportDetail(selectedReportId!),
    enabled: !!selectedReportId,
  });

  const resolveMutation = useMutation({
    mutationFn: resolveReport,
    onSuccess: async () => {
      const targetProfileId = selectedReport?.targetOwner?.id ?? null;
      setSelectedReportId(null);
      await invalidateModerationDashboardQueries(queryClient, targetProfileId);
    },
  });

  const openInvestigationMutation = useMutation({
    mutationFn: openBoardInvestigation,
    onSuccess: async (data) => {
      await invalidateModerationDashboardQueries(
        queryClient,
        selectedReport?.targetOwner?.id ?? null,
      );
      onViewInvestigation(data.investigationId);
    },
  });

  const handleResolve = (action: "dismiss" | "warning" | "strike" | "ban") => {
    if (!selectedReportId) return;

    const confirmed = window.confirm(
      `Are you sure you want to ${action} this report target?`,
    );

    if (!confirmed) return;

    resolveMutation.mutate({
      reportId: selectedReportId,
      action,
    });
  };

  if (selectedReportId || isLoadingDetail) {
    return (
        <ReportDetailView
          report={selectedReport ?? null}
          isLoading={isLoadingDetail}
          isResolving={resolveMutation.isPending}
          onBack={() => setSelectedReportId(null)}
          onResolve={handleResolve}
          onViewBoard={onViewBoard}
          onOpenInvestigation={(reportId) =>
            openInvestigationMutation.mutate(reportId)
          }
          isOpeningInvestigation={openInvestigationMutation.isPending}
        />
      );
  }

  return (
    <div className="space-y-6">
      <div className={HEADER_PANEL_SHELL}>
        <div className="-mb-3 -mt-3 border-b border-theme-border pb-0.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-theme-text-primary">
                {t.moderation.reports}
              </h2>
              <p className="-mt-1 text-sm text-theme-text-tertiary">
                {t.moderation.reportsSubtitle}
              </p>
            </div>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className={subtleButtonClass}
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-theme-text-tertiary" />
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-1 text-center">
          <ShieldAlert className="mb-3 h-12 w-12 text-theme-text-muted" />
          <p className="text-md font-medium text-theme-text-tertiary">
            {t.moderation.noReports}
          </p>
          <p className="mt-1 text-sm text-theme-text-muted">
            {t.moderation.reportsQueueEmptyDescription}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report.id} className={REPORT_ROW_CLASS}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-theme-text-primary">
                  <span className={metaBadgeClass}>
                    {getTargetTypeIcon(report.targetType)}
                    <span className="ml-1">{formatReportTargetType(report.targetType)}</span>
                  </span>
                  <span
                    className={cn(
                      "rounded-none px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em]",
                      getPriorityColor(report.priority),
                    )}
                  >
                    {report.priority}
                  </span>
                  <span
                    className={cn(
                      "text-[11px] font-medium uppercase tracking-[0.05em]",
                      getReportStatusColor(report.status),
                    )}
                  >
                    {report.status}
                  </span>
                  <span className={metaBadgeClass}>
                    {report.category.replace(/_/g, " ").toLowerCase()}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-theme-text-primary">
                  {getPreviewText(report)}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-theme-text-tertiary">
                  <span>@{report.reporter?.username || "unknown"}</span>
                  {report.targetOwner && (
                    <span>Against @{report.targetOwner.username}</span>
                  )}
                  <span>{new Date(report.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <Button
                onClick={() => setSelectedReportId(report.id)}
                className={actionButtonClass}
              >
                Review
              </Button>
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
