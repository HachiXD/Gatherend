"use client";

import { Loader2, ScrollText } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import {
  fetchModerationActions,
  flattenCursorPages,
  type ModerationActionItem,
} from "../lib";

const HEADER_PANEL_SHELL =
  "border border-theme-border bg-theme-bg-overlay-primary/78 px-4 pt-4 pb-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.26)] sm:px-5 sm:py-5";
const ACTION_ROW_CLASS =
  "flex min-h-10 items-center gap-3 rounded-none border border-theme-border-subtle bg-theme-bg-edit-form/50 px-3 py-1";
const actionButtonClass =
  "h-6.5 min-w-[120px] cursor-pointer rounded-none bg-theme-tab-button-bg px-3 text-[14px] text-theme-text-light transition hover:bg-theme-tab-button-hover";
const actionBadgeClass =
  "inline-flex items-center rounded-none border border-theme-border bg-theme-bg-secondary/35 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-theme-text-muted";

function getActionLabel(
  t: ReturnType<typeof useTranslation>["t"],
  actionType: ModerationActionItem["actionType"],
) {
  switch (actionType) {
    case "WARNING":
      return t.moderation.warning;
    case "REMOVE_WARNING":
      return t.moderation.removeWarning;
    case "STRIKE":
      return t.moderation.strike;
    case "REMOVE_STRIKE":
      return t.moderation.removeStrike;
    case "BAN":
      return t.moderation.ban;
    case "UNBAN":
      return t.moderation.unban;
    case "AUTO_BAN":
      return t.moderation.autoBan;
    case "AUTO_UNBAN":
      return t.moderation.autoUnban;
    case "CLEAR_STRIKES":
      return t.moderation.clearStrikes;
    case "NOTE":
      return t.moderation.note;
    default:
      return actionType;
  }
}

function getActionDescription(
  t: ReturnType<typeof useTranslation>["t"],
  action: ModerationActionItem,
) {
  const actor = action.issuedBy?.username || t.moderation.unknownAdmin;

  switch (action.actionType) {
    case "WARNING":
      return `${t.moderation.warning} by ${actor}`;
    case "REMOVE_WARNING":
      return `${t.moderation.removeWarning} by ${actor}`;
    case "STRIKE":
      return `${t.moderation.strike} by ${actor}`;
    case "REMOVE_STRIKE":
      return `${t.moderation.removeStrike} by ${actor}`;
    case "BAN":
      return `${t.moderation.ban} by ${actor}`;
    case "UNBAN":
      return `${t.moderation.unban} by ${actor}`;
    case "AUTO_BAN":
      return t.moderation.autoBanDescription;
    case "AUTO_UNBAN":
      return t.moderation.autoUnbanDescription;
    case "CLEAR_STRIKES":
      return `${t.moderation.clearStrikes} by ${actor}`;
    case "NOTE":
      return action.notes || t.moderation.note;
    default:
      return action.notes || action.actionType;
  }
}

export const HistoryTab = () => {
  const { t } = useTranslation();
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useInfiniteQuery({
      queryKey: ["moderation", "actions"],
      queryFn: ({ pageParam }: { pageParam?: string | null }) =>
        fetchModerationActions(pageParam),
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage) =>
        lastPage.hasMore ? lastPage.nextCursor : undefined,
      staleTime: 30_000,
    });

  const actions = flattenCursorPages(data);

  return (
    <div className="space-y-6">
      <div className={HEADER_PANEL_SHELL}>
        <div className="-mb-3 -mt-3 border-b border-theme-border pb-0.5">
          <h2 className="text-2xl font-bold text-theme-text-primary">
            {t.moderation.history}
          </h2>
          <p className="-mt-1 text-sm text-theme-text-tertiary">
            {t.moderation.historySubtitle}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-theme-text-tertiary" />
        </div>
      ) : actions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-1 text-center">
          <ScrollText className="mb-3 h-12 w-12 text-theme-text-muted" />
          <p className="text-md font-medium text-theme-text-tertiary">
            {t.moderation.noHistory}
          </p>
          <p className="mt-1 text-sm text-theme-text-muted">
            {t.moderation.historyEmptyDescription}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {actions.map((action) => (
            <div key={action.id} className={cn(ACTION_ROW_CLASS, "gap-2")}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-theme-text-primary">
                  <span className="truncate">
                    @{action.profile?.username || t.moderation.unknownUser}
                    {action.profile?.discriminator
                      ? `/${action.profile.discriminator}`
                      : ""}
                  </span>
                  <span className={actionBadgeClass}>
                    {getActionLabel(t, action.actionType)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-theme-text-muted">
                  {getActionDescription(t, action)}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-theme-text-tertiary">
                  <span>{new Date(action.createdAt).toLocaleString()}</span>
                  {action.report && (
                    <span>
                      {action.report.category.replace(/_/g, " ").toLowerCase()}
                    </span>
                  )}
                  {action.warning && (
                    <span>{t.moderation.warningStatus}: {action.warning.status}</span>
                  )}
                  {action.strike && (
                    <span>{action.strike.severity}</span>
                  )}
                </div>
                {action.notes && action.actionType !== "NOTE" && (
                  <p className="mt-1 text-[11px] text-theme-text-muted">
                    {action.notes}
                  </p>
                )}
              </div>
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
