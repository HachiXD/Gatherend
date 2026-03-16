"use client";

import { useState } from "react";
import {
  Flag,
  Loader2,
  RefreshCw,
  ArrowLeft,
  User,
  MessageSquare,
  Users,
  FileWarning,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

// Types
interface ModerationProfile {
  id: string;
  username: string;
  discriminator: string | null;
  avatarAsset: ClientUploadedAsset | null;
}

interface ReportSnapshot {
  // For BOARD
  name?: string;
  description?: string;
  imageUrl?: string;
  ownerId?: string;
  ownerUsername?: string;
  // For MESSAGE/DM
  content?: string;
  fileUrl?: string;
  senderId?: string;
  senderUsername?: string;
  // For COMMUNITY_POST
  authorId?: string;
  authorUsername?: string;
  authorDiscriminator?: string;
  // For PROFILE
  username?: string;
  discriminator?: string;
  longDescription?: string;
  userId?: string;
}

interface ReportItem {
  id: string;
  targetType:
    | "MESSAGE"
    | "DIRECT_MESSAGE"
    | "PROFILE"
    | "BOARD"
    | "COMMUNITY"
    | "COMMUNITY_POST";
  targetId: string;
  category: string;
  status: "PENDING" | "REVIEWING" | "ACTION_TAKEN" | "DISMISSED";
  priority: string;
  description: string | null;
  createdAt: string;
  reporter: ModerationProfile | null;
  targetOwner:
    | (ModerationProfile & {
        userId: string;
      })
    | null;
  snapshot: ReportSnapshot;
}

interface ReportDetail extends ReportItem {
  // Additional context for review
  boardMembers?: Array<{
    id: string;
    role: string;
    profile: ModerationProfile | null;
  }>;
  messageContext?: Array<{
    id: string;
    content: string;
    createdAt: string;
    member: {
      profile: ModerationProfile | null;
    } | null;
    isReported: boolean;
  }>;
  community?: {
    id: string;
    name: string;
    createdBy: ModerationProfile | null;
  };
  communityPost?: {
    id: string;
    content: string;
    deleted: boolean;
    createdAt: string;
    community: {
      id: string;
      name: string;
    };
    author: ModerationProfile | null;
  };
}

interface ReportsResponse {
  reports: ReportItem[];
}

const fetchReports = async (filter: string): Promise<ReportsResponse> => {
  const res = await fetch(`/api/moderation/reports?filter=${filter}`);
  if (!res.ok) throw new Error("Failed to fetch reports");
  return res.json();
};

const fetchReportDetail = async (reportId: string): Promise<ReportDetail> => {
  const res = await fetch(`/api/moderation/reports/${reportId}`);
  if (!res.ok) throw new Error("Failed to fetch report detail");
  return res.json();
};

const resolveReport = async ({
  reportId,
  action,
}: {
  reportId: string;
  action: string;
}): Promise<void> => {
  const res = await fetch(`/api/moderation/reports/${reportId}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) throw new Error("Failed to resolve report");
};

export const ReportsTab = () => {
  const [filter, setFilter] = useState<"all" | "pending" | "resolved">(
    "pending"
  );
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch reports list
  const {
    data: reportsData,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["moderation", "reports", filter],
    queryFn: () => fetchReports(filter),
    staleTime: 0,
  });

  // Fetch report detail
  const { data: selectedReport, isLoading: isLoadingDetail } = useQuery({
    queryKey: ["moderation", "report", selectedReportId],
    queryFn: () => fetchReportDetail(selectedReportId!),
    enabled: !!selectedReportId,
  });

  // Resolve mutation
  const resolveMutation = useMutation({
    mutationFn: resolveReport,
    onSuccess: () => {
      setSelectedReportId(null);
      queryClient.invalidateQueries({ queryKey: ["moderation", "reports"] });
      queryClient.invalidateQueries({ queryKey: ["moderation", "stats"] });
    },
  });

  const handleReview = (reportId: string) => {
    setSelectedReportId(reportId);
  };

  const handleResolve = (action: "dismiss" | "strike" | "ban" | "warning") => {
    if (!selectedReportId) return;
    resolveMutation.mutate({ reportId: selectedReportId, action });
  };

  const reports = reportsData?.reports ?? [];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "text-red-500 bg-red-500/10";
      case "high":
        return "text-orange-500 bg-orange-500/10";
      case "medium":
        return "text-yellow-500 bg-yellow-500/10";
      default:
        return "text-gray-400 bg-gray-500/10";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "text-yellow-400";
      case "REVIEWING":
        return "text-blue-400";
      case "ACTION_TAKEN":
        return "text-green-400";
      case "DISMISSED":
        return "text-gray-400";
      default:
        return "text-gray-400";
    }
  };

  const getTargetTypeIcon = (type: string) => {
    switch (type) {
      case "MESSAGE":
      case "DIRECT_MESSAGE":
        return <MessageSquare className="w-4 h-4" />;
      case "PROFILE":
        return <User className="w-4 h-4" />;
      case "BOARD":
        return <Users className="w-4 h-4" />;
      case "COMMUNITY":
        return <Users className="w-4 h-4" />;
      case "COMMUNITY_POST":
        return <FileWarning className="w-4 h-4" />;
      default:
        return <Flag className="w-4 h-4" />;
    }
  };

  const getTargetTypeLabel = (type: string) => {
    switch (type) {
      case "MESSAGE":
        return "Message";
      case "DIRECT_MESSAGE":
        return "DM";
      case "PROFILE":
        return "Profile";
      case "BOARD":
        return "Board";
      case "COMMUNITY":
        return "Community";
      case "COMMUNITY_POST":
        return "Community Post";
      default:
        return type;
    }
  };

  // Detail View
  if (selectedReportId || isLoadingDetail) {
    return (
      <ReportDetailView
        report={selectedReport ?? null}
        isLoading={isLoadingDetail}
        onBack={() => setSelectedReportId(null)}
        onResolve={handleResolve}
        getPriorityColor={getPriorityColor}
        getStatusColor={getStatusColor}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-theme-text-primary">
            Reports
          </h1>
          <p className="text-sm text-theme-text-subtle mt-1">
            Review and manage user reports
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="px-3 py-1.5 rounded-md bg-theme-bg-input border border-theme-border-primary text-sm text-theme-text-primary"
          >
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="all">All</option>
          </select>

          {/* Refresh */}
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

      {/* Reports List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-theme-text-subtle" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12">
            <Flag className="w-12 h-12 text-theme-text-tertiary mx-auto mb-3" />
            <p className="text-theme-text-subtle">No reports found</p>
            <p className="text-sm text-theme-text-tertiary mt-1">
              {filter === "pending"
                ? "All caught up! No pending reports."
                : "No reports match your filter."}
            </p>
          </div>
        ) : (
          reports.map((report) => (
            <div
              key={report.id}
              className="p-4 rounded-lg bg-theme-bg-secondary border border-theme-border-primary hover:border-theme-border-secondary transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Type & Category */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-theme-bg-tertiary text-theme-text-subtle">
                      {getTargetTypeIcon(report.targetType)}
                      {getTargetTypeLabel(report.targetType)}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded capitalize",
                        getPriorityColor(report.priority)
                      )}
                    >
                      {report.priority}
                    </span>
                    <span
                      className={cn("text-xs", getStatusColor(report.status))}
                    >
                      {report.status}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-theme-bg-tertiary text-theme-text-subtle capitalize">
                      {report.category.replace("_", " ")}
                    </span>
                  </div>

                  {/* Content Preview */}
                  <p className="text-sm text-theme-text-primary line-clamp-2">
                    {report.snapshot.content ||
                      report.snapshot.description ||
                      report.snapshot.name ||
                      report.snapshot.authorUsername ||
                      report.snapshot.username ||
                      "No content"}
                  </p>

                  {/* Meta */}
                  <div className="flex items-center gap-4 mt-2 text-xs text-theme-text-tertiary">
                    <span>
                      Reported by @
                      {report.reporter?.username || "unknown"}
                    </span>
                    {report.targetOwner && (
                      <span>Against @{report.targetOwner.username}</span>
                    )}
                    <span>
                      {new Date(report.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleReview(report.id)}
                    className="px-3 py-1.5 text-xs font-medium rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
                  >
                    Review
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Report Detail View Component
interface ReportDetailViewProps {
  report: ReportDetail | null;
  isLoading: boolean;
  onBack: () => void;
  onResolve: (action: "dismiss" | "strike" | "ban" | "warning") => void;
  getPriorityColor: (priority: string) => string;
  getStatusColor: (status: string) => string;
}

const ReportDetailView = ({
  report,
  isLoading,
  onBack,
  onResolve,
  getPriorityColor,
  getStatusColor,
}: ReportDetailViewProps) => {
  if (isLoading || !report) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-theme-text-subtle" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button & Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-md hover:bg-theme-bg-tab-hover transition"
        >
          <ArrowLeft className="w-5 h-5 text-theme-text-subtle" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-theme-text-primary">
            Review Report
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded capitalize",
                getPriorityColor(report.priority)
              )}
            >
              {report.priority}
            </span>
            <span className={cn("text-xs", getStatusColor(report.status))}>
              {report.status}
            </span>
            <span className="text-xs text-theme-text-tertiary">
              {new Date(report.createdAt).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Reporter Info */}
      <div className="p-4 rounded-lg bg-theme-bg-secondary border border-theme-border-primary">
        <h3 className="text-sm font-medium text-theme-text-primary mb-2">
          Reported By
        </h3>
        <div className="flex items-center gap-3">
          <img
            src={report.reporter?.avatarAsset?.url || undefined}
            alt=""
            className="w-8 h-8 rounded-full"
          />
          <div>
            <p className="text-sm text-theme-text-primary">
              @{report.reporter?.username || "unknown"}/
              {report.reporter?.discriminator || "unknown"}
            </p>
            {report.description && (
              <p className="text-xs text-theme-text-subtle mt-1">
                "{report.description}"
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content Based on Type */}
      {report.targetType === "BOARD" && <BoardReportContent report={report} />}
      {(report.targetType === "MESSAGE" ||
        report.targetType === "DIRECT_MESSAGE") && (
        <MessageReportContent report={report} />
      )}
      {report.targetType === "PROFILE" && (
        <ProfileReportContent report={report} />
      )}
      {report.targetType === "COMMUNITY" && (
        <CommunityReportContent report={report} />
      )}
      {report.targetType === "COMMUNITY_POST" && (
        <CommunityPostReportContent report={report} />
      )}

      {/* Actions */}
      {report.status === "PENDING" && (
        <div className="flex items-center gap-3 pt-4 border-t border-theme-border-primary">
          <button
            onClick={() => onResolve("dismiss")}
            className="px-4 py-2 text-sm font-medium rounded bg-theme-bg-tertiary text-theme-text-subtle hover:bg-theme-bg-tab-hover transition"
          >
            Dismiss
          </button>
          <button
            onClick={() => onResolve("warning")}
            className="px-4 py-2 text-sm font-medium rounded bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition"
          >
            Issue Warning
          </button>
          <button
            onClick={() => onResolve("strike")}
            className="px-4 py-2 text-sm font-medium rounded bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition"
          >
            Issue Strike
          </button>
          <button
            onClick={() => onResolve("ban")}
            className="px-4 py-2 text-sm font-medium rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
          >
            Ban User
          </button>
        </div>
      )}
    </div>
  );
};

// Board Report Content
const BoardReportContent = ({ report }: { report: ReportDetail }) => {
  return (
    <div className="space-y-4">
      {/* Board Snapshot */}
      <div className="p-4 rounded-lg bg-theme-bg-secondary border border-theme-border-primary">
        <h3 className="text-sm font-medium text-theme-text-primary mb-3">
          Board Snapshot (at time of report)
        </h3>
        <div className="flex gap-4">
          {report.snapshot.imageUrl && (
            <img
              src={report.snapshot.imageUrl}
              alt=""
              className="w-24 h-24 rounded-lg object-cover"
            />
          )}
          <div className="flex-1">
            <p className="font-medium text-theme-text-primary">
              {report.snapshot.name}
            </p>
            <p className="text-sm text-theme-text-subtle mt-1">
              {report.snapshot.description || "No description"}
            </p>
            <p className="text-xs text-theme-text-tertiary mt-2">
              Owner: @{report.snapshot.ownerUsername}
            </p>
          </div>
        </div>
      </div>

      {/* Board Members */}
      {report.boardMembers && report.boardMembers.length > 0 && (
        <div className="p-4 rounded-lg bg-theme-bg-secondary border border-theme-border-primary">
          <h3 className="text-sm font-medium text-theme-text-primary mb-3">
            Current Members ({report.boardMembers.length})
          </h3>
          <div className="space-y-2">
            {report.boardMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-2 rounded bg-theme-bg-tertiary"
              >
                <img
                  src={member.profile?.avatarAsset?.url || undefined}
                  alt=""
                  className="w-8 h-8 rounded-full"
                />
                <div className="flex-1">
                    <p className="text-sm text-theme-text-primary">
                    @{member.profile?.username}/{member.profile?.discriminator}
                    </p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-theme-bg-secondary text-theme-text-tertiary">
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Message Report Content
const MessageReportContent = ({ report }: { report: ReportDetail }) => {
  return (
    <div className="space-y-4">
      {/* Reported Message Snapshot */}
      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
        <h3 className="text-sm font-medium text-red-400 mb-3">
          Reported Message (snapshot)
        </h3>
        <div className="flex gap-3">
          <div className="flex-1">
            <p className="text-xs text-theme-text-tertiary mb-1">
              From @{report.snapshot.senderUsername}
            </p>
            <p className="text-sm text-theme-text-primary whitespace-pre-wrap">
              {report.snapshot.content}
            </p>
            {report.snapshot.fileUrl && (
              <div className="mt-2">
                <img
                  src={report.snapshot.fileUrl}
                  alt=""
                  className="max-w-xs rounded-lg"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Message Context */}
      {report.messageContext && report.messageContext.length > 0 && (
        <div className="p-4 rounded-lg bg-theme-bg-secondary border border-theme-border-primary">
          <h3 className="text-sm font-medium text-theme-text-primary mb-3">
            Message Context (±10 messages, current state)
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {report.messageContext.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "p-3 rounded",
                  msg.isReported
                    ? "bg-red-500/10 border border-red-500/20"
                    : "bg-theme-bg-tertiary"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  {msg.member?.profile && (
                    <>
                      <img
                        src={msg.member.profile?.avatarAsset?.url || undefined}
                        alt=""
                        className="w-5 h-5 rounded-full"
                      />
                      <span className="text-xs font-medium text-theme-text-primary">
                        @{msg.member.profile?.username}
                      </span>
                    </>
                  )}
                  <span className="text-xs text-theme-text-tertiary">
                    {new Date(msg.createdAt).toLocaleString()}
                  </span>
                  {msg.isReported && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                      REPORTED
                    </span>
                  )}
                </div>
                <p className="text-sm text-theme-text-primary whitespace-pre-wrap">
                  {msg.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Profile Report Content
const ProfileReportContent = ({ report }: { report: ReportDetail }) => {
  return (
    <div className="p-4 rounded-lg bg-theme-bg-secondary border border-theme-border-primary">
      <h3 className="text-sm font-medium text-theme-text-primary mb-3">
        Reported Profile
      </h3>
      <div className="flex items-start gap-4">
        {report.targetOwner && (
          <img
            src={report.targetOwner?.avatarAsset?.url || undefined}
            alt=""
            className="w-16 h-16 rounded-full"
          />
        )}
        <div className="flex-1">
          <p className="font-medium text-theme-text-primary">
            @{report.snapshot.username}/{report.snapshot.discriminator}
          </p>
          <p className="text-xs text-theme-text-tertiary mt-1">
            User ID: {report.snapshot.userId || report.targetOwner?.userId}
          </p>
          {report.snapshot.longDescription && (
            <p className="text-sm text-theme-text-subtle mt-2">
              Bio: "{report.snapshot.longDescription}"
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const CommunityReportContent = ({ report }: { report: ReportDetail }) => {
  return (
    <div className="p-4 rounded-lg bg-theme-bg-secondary border border-theme-border-primary">
      <h3 className="text-sm font-medium text-theme-text-primary mb-3">
        Reported Community
      </h3>
      <div className="space-y-2">
        <p className="font-medium text-theme-text-primary">
          {report.snapshot.name || report.community?.name || "Unknown"}
        </p>
        {report.snapshot.imageUrl && (
          <img
            src={report.snapshot.imageUrl}
            alt=""
            className="h-32 w-full rounded-lg object-cover"
          />
        )}
        {report.community?.createdBy && (
          <p className="text-sm text-theme-text-subtle">
            Owner: @{report.community.createdBy.username}
          </p>
        )}
      </div>
    </div>
  );
};

const CommunityPostReportContent = ({ report }: { report: ReportDetail }) => {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
        <h3 className="text-sm font-medium text-red-400 mb-3">
          Reported Post (snapshot)
        </h3>
        <div className="space-y-2">
          <p className="text-xs text-theme-text-tertiary">
            From @{report.snapshot.authorUsername || "unknown"}
          </p>
          <p className="text-sm whitespace-pre-wrap text-theme-text-primary">
            {report.snapshot.content || "No text content"}
          </p>
          {report.snapshot.imageUrl && (
            <img
              src={report.snapshot.imageUrl}
              alt=""
              className="max-w-xs rounded-lg"
            />
          )}
        </div>
      </div>

      {report.communityPost && (
        <div className="p-4 rounded-lg bg-theme-bg-secondary border border-theme-border-primary">
          <h3 className="text-sm font-medium text-theme-text-primary mb-3">
            Current Post State
          </h3>
          <div className="space-y-2">
            <p className="text-sm text-theme-text-subtle">
              Community: {report.communityPost.community.name}
            </p>
            {report.communityPost.author && (
              <p className="text-sm text-theme-text-subtle">
                Author: @{report.communityPost.author.username}
              </p>
            )}
            <p className="text-sm whitespace-pre-wrap text-theme-text-primary">
              {report.communityPost.deleted
                ? "This post has been deleted."
                : report.communityPost.content || "No text content"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
