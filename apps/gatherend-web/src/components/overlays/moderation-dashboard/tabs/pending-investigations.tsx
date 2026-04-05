"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  SearchCheck,
  Trash2,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  deleteBoard,
  fetchBoardInvestigationDetail,
  fetchBoardInvestigations,
  invalidateModerationDashboardQueries,
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
const dangerButtonClass =
  "h-6.5 min-w-[120px] cursor-pointer rounded-none bg-red-600 px-3 text-[14px] text-white transition hover:bg-red-500 disabled:opacity-50";
const metaBadgeClass =
  "inline-flex items-center rounded-none border border-theme-border bg-theme-bg-secondary/35 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-theme-text-muted";

interface PendingInvestigationsTabProps {
  initialInvestigationId?: string | null;
  onViewBoard: (boardId: string) => void;
}

export const PendingInvestigationsTab = ({
  initialInvestigationId,
  onViewBoard,
}: PendingInvestigationsTabProps) => {
  const queryClient = useQueryClient();
  const [selectedInvestigationId, setSelectedInvestigationId] = useState<
    string | null
  >(initialInvestigationId ?? null);

  useEffect(() => {
    if (initialInvestigationId) {
      setSelectedInvestigationId(initialInvestigationId);
    }
  }, [initialInvestigationId]);

  const listQuery = useQuery({
    queryKey: ["moderation", "board-investigations"],
    queryFn: fetchBoardInvestigations,
  });

  const detailQuery = useQuery({
    queryKey: ["moderation", "board-investigations", "detail", selectedInvestigationId],
    queryFn: () => fetchBoardInvestigationDetail(selectedInvestigationId!),
    enabled: !!selectedInvestigationId,
  });

  const deleteMutation = useMutation({
    mutationFn: ({
      boardId,
      investigationId,
      sourceReportId,
    }: {
      boardId: string;
      investigationId: string;
      sourceReportId: string;
    }) =>
      deleteBoard(boardId, {
        investigationId,
        sourceReportId,
      }),
    onSuccess: async () => {
      await invalidateModerationDashboardQueries(queryClient);
      toast.success("Board deleted");
      setSelectedInvestigationId(null);
    },
    onError: (error: unknown) => {
      console.error(error);
      toast.error("Failed to delete board");
    },
  });

  const investigations = listQuery.data?.items ?? [];
  const detail = detailQuery.data;
  const selectedBoard = detail?.board ?? null;

  if (selectedInvestigationId) {
    return (
      <div className="space-y-6">
        <div className={HEADER_PANEL_SHELL}>
          <div className="-mb-3 -mt-3 border-b border-theme-border pb-0.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedInvestigationId(null)}
                  className={subtleButtonClass}
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-theme-text-primary">
                    Board Investigation
                  </h2>
                  <p className="-mt-1 text-sm text-theme-text-tertiary">
                    Review the board-linked context tied to this report.
                  </p>
                </div>
              </div>
              {detail?.boardId && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => onViewBoard(detail.boardId!)}
                    className={subtleButtonClass}
                  >
                    View board
                  </Button>
                  {selectedBoard ? (
                    <Button
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Delete board "${selectedBoard.name}" from the platform? This is permanent.`,
                          )
                        ) {
                          return;
                        }
                        deleteMutation.mutate({
                          boardId: selectedBoard.id,
                          investigationId: detail.id,
                          sourceReportId: detail.sourceReport.id,
                        });
                      }}
                      className={dangerButtonClass}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          Delete Board
                        </>
                      )}
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>

        {detailQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-theme-text-tertiary" />
          </div>
        ) : detail ? (
          <>
            <div className={PANEL_CLASS}>
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-theme-text-primary">
                <span className={metaBadgeClass}>{detail.status}</span>
                <span className={metaBadgeClass}>{detail.sourceReport.targetType}</span>
                <span className={metaBadgeClass}>{detail.sourceReport.category}</span>
              </div>
              <p className="mt-2 text-sm text-theme-text-muted">
                Opened by @{detail.openedBy?.username || "unknown"} on{" "}
                {new Date(detail.createdAt).toLocaleString()}
              </p>
              {detail.board && (
                <p className="mt-2 text-sm text-theme-text-primary">
                  Board: {detail.board.name}
                </p>
              )}
            </div>

            {detail.board && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className={PANEL_CLASS}>
                  <p className="text-xs uppercase tracking-[0.08em] text-theme-text-muted">
                    Board Summary
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-theme-text-primary">
                    <div className="flex flex-wrap gap-2">
                      <span className={metaBadgeClass}>
                        {detail.board.isPrivate ? "Private" : "Public"}
                      </span>
                      <span className={metaBadgeClass}>Risk {detail.board.riskLevel}</span>
                      <span className={metaBadgeClass}>{detail.board.reportCount} reports</span>
                    </div>
                    <p>{detail.board.description || "No description"}</p>
                    <p className="text-[11px] text-theme-text-muted">
                      Owner: @{detail.board.owner?.username || "unknown"}
                    </p>
                  </div>
                </div>

                <div className={PANEL_CLASS}>
                  <p className="text-xs uppercase tracking-[0.08em] text-theme-text-muted">
                    Staff
                  </p>
                  <div className="mt-3 space-y-2">
                    {detail.board.staff.map((staff) => (
                      <div key={staff.id} className={ITEM_ROW_CLASS}>
                        <UserAvatar
                          src={staff.profile?.avatarAsset?.url || ""}
                          profileId={staff.profile?.id}
                          showStatus={false}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-theme-text-primary">
                              @{staff.profile?.username || "unknown"}
                            </span>
                            <span className={metaBadgeClass}>{staff.role}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className={PANEL_CLASS}>
              <p className="text-xs uppercase tracking-[0.08em] text-theme-text-muted">
                Source Report
              </p>
              <div className="mt-3 space-y-2">
                <div className={ITEM_ROW_CLASS}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-theme-text-primary">
                      <span className={metaBadgeClass}>{detail.sourceReport.targetType}</span>
                      <span className={metaBadgeClass}>{detail.sourceReport.category}</span>
                      <span className={metaBadgeClass}>{detail.sourceReport.status}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-theme-text-muted">
                      @{detail.sourceReport.reporter?.username || "unknown"} •{" "}
                      {new Date(detail.sourceReport.createdAt).toLocaleString()}
                    </p>
                    {detail.sourceReport.description && (
                      <p className="mt-2 text-sm text-theme-text-primary">
                        {detail.sourceReport.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {detail.messageContext?.length ? (
              <div className={PANEL_CLASS}>
                <p className="text-xs uppercase tracking-[0.08em] text-theme-text-muted">
                  Message Context
                </p>
                <div className="mt-3 space-y-2">
                  {detail.messageContext.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        ITEM_ROW_CLASS,
                        message.isReported && "border-red-500/35 bg-red-500/5",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-theme-text-tertiary">
                          @{message.messageSender?.username || message.member?.profile?.username || "unknown"} •{" "}
                          {new Date(message.createdAt).toLocaleString()}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-theme-text-primary">
                          {message.content || "No message content"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {detail.communityPost && (
              <div className={PANEL_CLASS}>
                <p className="text-xs uppercase tracking-[0.08em] text-theme-text-muted">
                  Post Context
                </p>
                <div className="mt-3">
                  <div className={ITEM_ROW_CLASS}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-theme-text-tertiary">
                        @{detail.communityPost.author?.username || "unknown"} •{" "}
                        {new Date(detail.communityPost.createdAt).toLocaleString()}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-theme-text-primary">
                        {detail.communityPost.content || "No post content"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {detail.communityPostComment && (
              <div className={PANEL_CLASS}>
                <p className="text-xs uppercase tracking-[0.08em] text-theme-text-muted">
                  Comment Context
                </p>
                <div className="mt-3">
                  <div className={ITEM_ROW_CLASS}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-theme-text-tertiary">
                        @{detail.communityPostComment.author?.username || "unknown"} •{" "}
                        {new Date(detail.communityPostComment.createdAt).toLocaleString()}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-theme-text-primary">
                        {detail.communityPostComment.content || "No comment content"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <AlertTriangle className="mb-3 h-10 w-10 text-theme-text-muted" />
            <p className="text-sm text-theme-text-muted">Investigation not found.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={HEADER_PANEL_SHELL}>
        <div className="-mb-3 -mt-3 border-b border-theme-border pb-0.5">
          <div>
            <h2 className="text-2xl font-bold text-theme-text-primary">
              Pending Investigations
            </h2>
            <p className="-mt-1 text-sm text-theme-text-tertiary">
              Board-linked investigations opened from reports and waiting for review.
            </p>
          </div>
        </div>
      </div>

      {listQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-theme-text-tertiary" />
        </div>
      ) : investigations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <SearchCheck className="mb-3 h-10 w-10 text-theme-text-muted" />
          <p className="text-sm text-theme-text-muted">
            No pending board investigations.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {investigations.map((investigation) => (
            <button
              key={investigation.id}
              type="button"
              onClick={() => setSelectedInvestigationId(investigation.id)}
              className={cn(ITEM_ROW_CLASS, "w-full cursor-pointer text-left hover:border-theme-border")}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-theme-text-primary">
                  <span className={metaBadgeClass}>{investigation.status}</span>
                  <span className={metaBadgeClass}>{investigation.sourceReport.category}</span>
                  <span className="truncate">
                    {investigation.board?.name ||
                      String(investigation.boardSnapshot?.["name"] || "Deleted board")}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-theme-text-muted">
                  Opened by @{investigation.openedBy?.username || "unknown"} •{" "}
                  {new Date(investigation.createdAt).toLocaleString()}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
