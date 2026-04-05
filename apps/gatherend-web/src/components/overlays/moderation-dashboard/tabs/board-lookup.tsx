"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  Trash2,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  deleteBoard,
  fetchBoardDetail,
  invalidateModerationDashboardQueries,
  searchBoards,
  type ModerationBoardLookupItem,
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

function BoardSearchRow({
  board,
  onSelect,
}: {
  board: ModerationBoardLookupItem;
  onSelect: (boardId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(board.id)}
      className={cn(ITEM_ROW_CLASS, "w-full cursor-pointer text-left hover:border-theme-border")}
    >
      {board.imageAsset?.url ? (
        <img
          src={board.imageAsset.url}
          alt=""
          className="h-10 w-10 rounded-none border border-theme-border object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-none border border-theme-border bg-theme-bg-secondary/35">
          <Shield className="h-4 w-4 text-theme-text-tertiary" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-theme-text-primary">
          <span className="truncate">{board.name}</span>
          <span className={metaBadgeClass}>{board.isPrivate ? "Private" : "Public"}</span>
          <span className={metaBadgeClass}>Risk {board.riskLevel}</span>
        </div>
        <p className="mt-1 text-[11px] text-theme-text-muted">
          @{board.owner?.username || "unknown"} • {board.memberCount} members •{" "}
          {board.reportCount} reports
        </p>
      </div>
    </button>
  );
}

interface BoardLookupTabProps {
  initialBoardId?: string | null;
}

export const BoardLookupTab = ({ initialBoardId }: BoardLookupTabProps) => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<ModerationBoardLookupItem[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(
    initialBoardId ?? null,
  );

  useEffect(() => {
    if (initialBoardId) {
      setSelectedBoardId(initialBoardId);
    }
  }, [initialBoardId]);

  const searchMutation = useMutation({
    mutationFn: searchBoards,
    onSuccess: (data) => setResults(data.items),
    onError: () => {
      setResults([]);
      toast.error("Failed to search boards");
    },
  });

  const detailQuery = useQuery({
    queryKey: ["moderation", "boards", "detail", selectedBoardId],
    queryFn: () => fetchBoardDetail(selectedBoardId!),
    enabled: !!selectedBoardId,
  });

  const deleteMutation = useMutation({
    mutationFn: (boardId: string) => deleteBoard(boardId),
    onSuccess: async () => {
      await invalidateModerationDashboardQueries(queryClient);
      toast.success("Board deleted");
      setSelectedBoardId(null);
      detailQuery.refetch();
    },
    onError: (error: unknown) => {
      console.error(error);
      toast.error("Failed to delete board");
    },
  });

  const handleSearch = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    searchMutation.mutate(trimmed);
  };

  const board = detailQuery.data;

  return (
    <div className="space-y-6">
      <div className={HEADER_PANEL_SHELL}>
        <div className="-mb-3 -mt-3 border-b border-theme-border pb-0.5">
          <div>
            <h2 className="text-2xl font-bold text-theme-text-primary">Board Lookup</h2>
            <p className="-mt-1 text-sm text-theme-text-tertiary">
              Search a board and review its public-facing metadata, staff, and risk summary.
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
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSearch();
            }}
            className="h-10 w-full rounded-none border border-theme-border bg-theme-bg-overlay-primary/60 px-10 text-sm text-theme-text-primary outline-none"
            placeholder="Search board by name or ID"
          />
        </div>
        <Button
          onClick={handleSearch}
          className={actionButtonClass}
          disabled={searchMutation.isPending}
        >
          {searchMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Search"
          )}
        </Button>
      </div>

      {results.length > 0 && !selectedBoardId && (
        <div className="space-y-3">
          {results.map((result) => (
            <BoardSearchRow key={result.id} board={result} onSelect={setSelectedBoardId} />
          ))}
        </div>
      )}

      {selectedBoardId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Button onClick={() => setSelectedBoardId(null)} className={subtleButtonClass}>
              Back
            </Button>
            <Button
              onClick={() => detailQuery.refetch()}
              disabled={detailQuery.isFetching}
              className={subtleButtonClass}
            >
              <RefreshCw className={cn("h-4 w-4", detailQuery.isFetching && "animate-spin")} />
            </Button>
          </div>

          {detailQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-theme-text-tertiary" />
            </div>
          ) : board ? (
            <>
              <div className={PANEL_CLASS}>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex min-w-0 gap-4">
                    {board.imageAsset?.url ? (
                      <img
                        src={board.imageAsset.url}
                        alt=""
                        className="h-20 w-20 rounded-none border border-theme-border object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-none border border-theme-border bg-theme-bg-secondary/35">
                        <Shield className="h-5 w-5 text-theme-text-tertiary" />
                      </div>
                    )}
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-bold text-theme-text-primary">{board.name}</h3>
                        <span className={metaBadgeClass}>
                          {board.isPrivate ? "Private" : "Public"}
                        </span>
                        <span className={metaBadgeClass}>Risk {board.riskLevel}</span>
                      </div>
                      {board.description && (
                        <p className="text-sm text-theme-text-muted">{board.description}</p>
                      )}
                      <div className="flex flex-wrap gap-2 text-[11px] text-theme-text-tertiary">
                        <span>ID: {board.id}</span>
                        <span>{board.memberCount} members</span>
                        <span>{board.reportCount} reports</span>
                        <span>Created {new Date(board.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-theme-text-primary">
                        <UserAvatar
                          src={board.owner?.avatarAsset?.url || ""}
                          profileId={board.owner?.id}
                          showStatus={false}
                        />
                        <span>@{board.owner?.username || "unknown owner"}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Delete board "${board.name}" from the platform? This is permanent.`,
                        )
                      ) {
                        return;
                      }
                      deleteMutation.mutate(board.id);
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
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className={PANEL_CLASS}>
                  <p className="text-xs uppercase tracking-[0.08em] text-theme-text-muted">
                    Staff
                  </p>
                  <div className="mt-3 space-y-2">
                    {board.staff.map((staff) => (
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

                <div className={PANEL_CLASS}>
                  <p className="text-xs uppercase tracking-[0.08em] text-theme-text-muted">
                    Recent Risk Events
                  </p>
                  <div className="mt-3 space-y-2">
                    {board.recentRiskEvents.length > 0 ? (
                      board.recentRiskEvents.map((event) => (
                        <div key={event.id} className={ITEM_ROW_CLASS}>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-sm font-semibold text-theme-text-primary">
                              <span className={metaBadgeClass}>
                                {event.delta > 0 ? `+${event.delta}` : event.delta}
                              </span>
                              <span className="truncate">{event.reason}</span>
                            </div>
                            <p className="mt-1 text-[11px] text-theme-text-muted">
                              {new Date(event.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-theme-text-muted">No risk events yet.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className={PANEL_CLASS}>
                <p className="text-xs uppercase tracking-[0.08em] text-theme-text-muted">
                  Recent Reports
                </p>
                <div className="mt-3 space-y-2">
                  {board.recentReports.length > 0 ? (
                    board.recentReports.map((report) => (
                      <div key={report.id} className={ITEM_ROW_CLASS}>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-theme-text-primary">
                            <span className={metaBadgeClass}>{report.targetType}</span>
                            <span className={metaBadgeClass}>{report.category}</span>
                            <span className={metaBadgeClass}>{report.status}</span>
                          </div>
                          <p className="mt-1 text-[11px] text-theme-text-muted">
                            @{report.reporter?.username || "unknown"} •{" "}
                            {new Date(report.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-theme-text-muted">No reports linked to this board.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <AlertTriangle className="mb-3 h-10 w-10 text-theme-text-muted" />
              <p className="text-sm text-theme-text-muted">Board not found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
