"use client";

import type {
  PlatformModerationActionType,
  PlatformWarningStatus,
  StrikeSourceType,
} from "@prisma/client";
import type { QueryClient } from "@tanstack/react-query";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

export interface ModerationProfile {
  id: string;
  userId?: string;
  username: string;
  discriminator: string | null;
  avatarAsset: ClientUploadedAsset | null;
  banned?: boolean;
  bannedAt?: string | null;
  banReason?: string | null;
  reputationScore?: number;
  _count?: {
    strikes?: number;
    reportsAgainst?: number;
  };
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ReportSnapshot {
  name?: string;
  description?: string;
  imageUrl?: string;
  ownerId?: string;
  ownerUsername?: string;
  content?: string;
  fileUrl?: string;
  senderId?: string;
  senderUsername?: string;
  authorId?: string;
  authorUsername?: string;
  authorDiscriminator?: string;
  username?: string;
  discriminator?: string;
  longDescription?: string;
  userId?: string;
}

export interface ModerationReportItem {
  id: string;
  targetType: string;
  targetId: string;
  boardId: string | null;
  channelId: string | null;
  category: string;
  status: "PENDING" | "REVIEWING" | "ACTION_TAKEN" | "DISMISSED";
  priority: string;
  description: string | null;
  createdAt: string;
  relationType?: "FILED" | "AGAINST";
  reporter: ModerationProfile | null;
  targetOwner: ModerationProfile | null;
  snapshot: ReportSnapshot;
}

export interface ModerationReportDetail extends ModerationReportItem {
  currentBoardMetadata?: ModerationBoardMetadata | null;
  messageContext?: Array<{
    id: string;
    content: string;
    createdAt: string;
    messageSender?: ModerationProfile | null;
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
  warningStats?: {
    active: number;
    promoted: number;
    removed: number;
  };
  recentWarnings?: PlatformWarningItem[];
  recentPlatformActions?: ModerationActionItem[];
  recentTargetStrikes?: StrikeItem[];
}

export interface ModerationBoardMetadata {
  id: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  inviteEnabled: boolean;
  reportCount: number;
  riskPoints: number;
  riskLevel: number;
  createdAt: string;
  imageAsset: ClientUploadedAsset | null;
  owner: ModerationProfile | null;
}

export interface ModerationBoardLookupItem extends ModerationBoardMetadata {
  hiddenFromFeed?: boolean;
  memberCount: number;
}

export interface BoardRiskEventItem {
  id: string;
  delta: number;
  reason: string;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: string;
  profile: ModerationProfile | null;
  report: {
    id: string;
    targetType: string;
    category: string;
    status: string;
    createdAt: string;
  } | null;
}

export interface PlatformBoardActionItem {
  id: string;
  actionType: string;
  notes: string | null;
  createdAt: string;
  issuedBy: ModerationProfile | null;
  sourceReport: {
    id: string;
    targetType: string;
    category: string;
    status: string;
    createdAt: string;
  } | null;
}

export interface ModerationBoardDetail extends ModerationBoardLookupItem {
  updatedAt: string;
  staff: Array<{
    id: string;
    role: string;
    createdAt: string;
    profile: ModerationProfile | null;
  }>;
  recentReports: Array<{
    id: string;
    targetType: string;
    category: string;
    status: string;
    priority: string;
    createdAt: string;
    reporter: ModerationProfile | null;
  }>;
  recentRiskEvents: BoardRiskEventItem[];
  recentPlatformBoardActions: PlatformBoardActionItem[];
}

export interface BoardInvestigationItem {
  id: string;
  boardId: string | null;
  status: "OPEN" | "CLOSED";
  notes: string | null;
  boardSnapshot: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  openedBy: ModerationProfile | null;
  sourceReport: {
    id: string;
    targetType: string;
    category: string;
    priority: string;
    status: string;
    boardId: string | null;
    createdAt: string;
  };
  board: ModerationBoardLookupItem | null;
}

export interface BoardInvestigationDetail extends BoardInvestigationItem {
  closedAt: string | null;
  closedBy: ModerationProfile | null;
  board: ModerationBoardDetail | null;
  sourceReport: {
    id: string;
    targetType: string;
    targetId: string;
    boardId: string | null;
    channelId: string | null;
    category: string;
    status: string;
    priority: string;
    description: string | null;
    snapshot: ReportSnapshot;
    createdAt: string;
    reporter: ModerationProfile | null;
    targetOwner: ModerationProfile | null;
  };
  messageContext?: ModerationReportDetail["messageContext"];
  communityPost?: ModerationReportDetail["communityPost"];
  communityPostComment?: {
    id: string;
    content: string;
    deleted: boolean;
    createdAt: string;
    post: {
      id: string;
      content: string;
      board: {
        id: string;
        name: string;
      };
    };
    author: ModerationProfile | null;
    replyToComment: {
      id: string;
      content: string;
      deleted: boolean;
      author: ModerationProfile | null;
    } | null;
  } | null;
}

export interface ModerationActionItem {
  id: string;
  actionType: PlatformModerationActionType;
  createdAt: string;
  notes: string | null;
  profile: ModerationProfile | null;
  issuedBy: ModerationProfile | null;
  report: {
    id: string;
    category: string;
    targetType: string;
    status: string;
    createdAt: string;
  } | null;
  warning: PlatformWarningItem | null;
  strike: {
    id: string;
    severity: string;
    reason: string;
    sourceType: StrikeSourceType;
    autoBanTriggered: boolean;
    createdAt: string;
  } | null;
}

export interface PlatformWarningItem {
  id: string;
  reason: string;
  notes: string | null;
  status: PlatformWarningStatus;
  removedAt: string | null;
  promotedToStrikeId?: string | null;
  createdAt: string;
  updatedAt: string;
  issuedBy?: ModerationProfile | null;
  removedBy?: ModerationProfile | null;
  report?: {
    id: string;
    category: string;
    targetType: string;
    status: string;
    createdAt: string;
  } | null;
  promotedToStrike?: {
    id: string;
    severity: string;
    reason?: string;
    sourceType: StrikeSourceType;
    createdAt: string;
  } | null;
}

export interface StrikeItem {
  id: string;
  reason: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  contentType: string;
  sourceType?: StrikeSourceType;
  createdAt: string;
  appealedAt?: string | null;
  appealResolvedAt?: string | null;
  expiresAt: string | null;
  autoDetected?: boolean;
  autoBanTriggered?: boolean;
  originReport?: {
    id: string;
    targetType: string;
    category: string;
    status?: string;
    createdAt?: string;
  } | null;
}

export interface UserLookupSummary {
  profile: ModerationProfile & {
    validReports: number;
    falseReports: number;
    reportAccuracy: number | null;
    createdAt: string;
    updatedAt: string;
  };
  recentWarnings: PlatformWarningItem[];
  recentPlatformActions: ModerationActionItem[];
  reportsFiled: ModerationReportItem[];
  reportsAgainst: Array<
    Pick<
      ModerationReportItem,
      "id" | "category" | "status" | "createdAt" | "targetType"
    > & {
      reporter: ModerationProfile | null;
    }
  >;
  strikes: StrikeItem[];
  boardsOwned: Array<{
    id: string;
    name: string;
    imageAsset: ClientUploadedAsset | null;
    reportCount: number;
    hiddenFromFeed: boolean;
    riskLevel?: number;
    createdAt: string;
    _count: { members: number };
  }>;
  stats: {
    warningStats: {
      active: number;
      promoted: number;
      removed: number;
    };
    strikeStats: {
      active: number;
      total: number;
      direct: number;
      warningEscalation: number;
    };
    totalReportsFiled: number;
    totalReportsAgainst: number;
    totalStrikes: number;
    activeStrikes: number;
    totalPlatformActions: number;
    boardsOwned: number;
    totalMessages: number;
    accountAge: number;
  };
}

export interface LookupResponse {
  profiles: Array<
    ModerationProfile & {
      banned: boolean;
      bannedAt: string | null;
      banReason: string | null;
      createdAt: string;
    }
  >;
  exact: boolean;
}

export interface ModerationStats {
  overview: {
    pendingReports: number;
    reviewingReports: number;
    actionTakenReports: number;
    dismissedReports: number;
    totalReports: number;
    totalStrikes: number;
    activeStrikes: number;
    activeWarnings: number;
    promotedWarnings: number;
    removedWarnings: number;
    directStrikes: number;
    warningEscalationStrikes: number;
    bannedUsers: number;
    autoBannedUsers: number;
    reportsToday: number;
    reportsThisWeek: number;
    actionsThisWeek: number;
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
      discriminator: string | null;
    } | null;
  }>;
  recentActions: Array<{
    id: string;
    actionType: PlatformModerationActionType;
    createdAt: string;
    profile: ModerationProfile | null;
    issuedBy: ModerationProfile | null;
  }>;
  topReporters: Array<
    ModerationProfile & {
      validReports: number;
      falseReports: number;
      reportAccuracy: number | null;
    }
  >;
  mostReportedUsers: Array<
    ModerationProfile & {
      userId?: string;
      _count?: {
        reportsAgainst: number;
        strikes: number;
      };
    }
  >;
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error || "Request failed");
  }

  return response.json() as Promise<T>;
}

export function flattenCursorPages<T>(data?: {
  pages?: Array<CursorPage<T>>;
}): T[] {
  return data?.pages?.flatMap((page) => page.items) ?? [];
}

export async function fetchReportsQueue(cursor?: string | null) {
  return fetchJson<CursorPage<ModerationReportItem>>(
    `/api/moderation/reports${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
  );
}

export async function fetchReportDetail(reportId: string) {
  return fetchJson<ModerationReportDetail>(`/api/moderation/reports/${reportId}`);
}

export async function resolveReport(input: {
  reportId: string;
  action: "dismiss" | "strike" | "ban" | "warning";
}) {
  return fetchJson<{ success: true }>(
    `/api/moderation/reports/${input.reportId}/resolve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: input.action }),
    },
  );
}

export async function fetchModerationActions(cursor?: string | null) {
  return fetchJson<CursorPage<ModerationActionItem>>(
    `/api/moderation/actions${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
  );
}

export async function fetchBannedUsers(cursor?: string | null) {
  const query = new URLSearchParams();
  if (cursor) query.set("cursor", cursor);
  return fetchJson<
    CursorPage<ModerationProfile> & { bannedUsers: ModerationProfile[]; total: number }
  >(`/api/moderation/banned-users${query.toString() ? `?${query.toString()}` : ""}`);
}

export async function lookupProfiles(query: string) {
  return fetchJson<LookupResponse>(
    `/api/moderation/lookup?q=${encodeURIComponent(query)}`,
  );
}

export async function fetchUserSummary(profileId: string) {
  return fetchJson<UserLookupSummary>(`/api/moderation/users/${profileId}`);
}

export async function fetchUserReports(profileId: string, cursor?: string | null) {
  const query = new URLSearchParams();
  query.set("scope", "all");
  if (cursor) query.set("cursor", cursor);
  return fetchJson<CursorPage<ModerationReportItem>>(
    `/api/moderation/users/${profileId}/reports?${query.toString()}`,
  );
}

export async function fetchUserActions(profileId: string, cursor?: string | null) {
  const query = new URLSearchParams();
  if (cursor) query.set("cursor", cursor);
  return fetchJson<CursorPage<ModerationActionItem>>(
    `/api/moderation/users/${profileId}/actions?${query.toString()}`,
  );
}

export async function fetchUserStrikes(profileId: string, cursor?: string | null) {
  const query = new URLSearchParams();
  if (cursor) query.set("cursor", cursor);
  return fetchJson<CursorPage<StrikeItem>>(
    `/api/moderation/users/${profileId}/strikes?${query.toString()}`,
  );
}

export async function fetchUserWarnings(profileId: string, cursor?: string | null) {
  const query = new URLSearchParams();
  if (cursor) query.set("cursor", cursor);
  return fetchJson<CursorPage<PlatformWarningItem>>(
    `/api/moderation/users/${profileId}/warnings?${query.toString()}`,
  );
}

export async function banUser(profileId: string, reason?: string) {
  return fetchJson<{ success: true }>(`/api/moderation/users/${profileId}/ban`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: reason?.trim() || undefined }),
  });
}

export async function unbanUser(profileId: string) {
  return fetchJson<{ success: true }>(`/api/moderation/users/${profileId}/ban`, {
    method: "DELETE",
  });
}

export async function warnUser(profileId: string, reason: string) {
  return fetchJson<{ success: true; promotedStrikeIds?: string[] }>(
    `/api/moderation/users/${profileId}/warning`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    },
  );
}

export async function strikeUser(profileId: string, reason: string) {
  return fetchJson<{ success: true; strikeId: string; autoBanned?: boolean }>(
    `/api/moderation/users/${profileId}/strike`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    },
  );
}

export async function clearUserStrikes(profileId: string) {
  return fetchJson<{ success: true }>(
    `/api/moderation/users/${profileId}/strikes/clear`,
    {
      method: "POST",
    },
  );
}

export async function removeWarning(warningId: string) {
  return fetchJson<{ success: true }>(`/api/moderation/warnings/${warningId}`, {
    method: "DELETE",
  });
}

export async function removeStrike(strikeId: string) {
  return fetchJson<{ success: true }>(`/api/moderation/strikes/${strikeId}`, {
    method: "DELETE",
  });
}

export async function fetchStats() {
  return fetchJson<ModerationStats>("/api/moderation/stats");
}

export async function searchBoards(query: string) {
  return fetchJson<{ items: ModerationBoardLookupItem[] }>(
    `/api/moderation/boards/search?q=${encodeURIComponent(query)}`,
  );
}

export async function fetchBoardDetail(boardId: string) {
  return fetchJson<ModerationBoardDetail>(`/api/moderation/boards/${boardId}`);
}

export async function deleteBoard(
  boardId: string,
  input?: {
    investigationId?: string;
    sourceReportId?: string;
    notes?: string;
  },
) {
  return fetchJson<{ success: true; deletedBoardId: string; actionId: string }>(
    `/api/moderation/boards/${boardId}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input ?? {}),
    },
  );
}

export async function openBoardInvestigation(reportId: string) {
  return fetchJson<{ success: true; investigationId: string; existing: boolean }>(
    `/api/moderation/reports/${reportId}/investigation`,
    {
      method: "POST",
    },
  );
}

export async function fetchBoardInvestigations() {
  return fetchJson<{ items: BoardInvestigationItem[] }>(
    "/api/moderation/board-investigations",
  );
}

export async function fetchBoardInvestigationDetail(investigationId: string) {
  return fetchJson<BoardInvestigationDetail>(
    `/api/moderation/board-investigations/${investigationId}`,
  );
}

export async function invalidateModerationDashboardQueries(
  queryClient: QueryClient,
  profileId?: string | null,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["moderation", "reports"] }),
    queryClient.invalidateQueries({ queryKey: ["moderation", "actions"] }),
    queryClient.invalidateQueries({ queryKey: ["moderation", "banned-users"] }),
    queryClient.invalidateQueries({ queryKey: ["moderation", "stats"] }),
    queryClient.invalidateQueries({ queryKey: ["moderation", "boards"] }),
    queryClient.invalidateQueries({ queryKey: ["moderation", "board-investigations"] }),
    ...(profileId
      ? [
          queryClient.invalidateQueries({
            queryKey: ["moderation", "user-summary", profileId],
          }),
          queryClient.invalidateQueries({
            queryKey: ["moderation", "user-reports", profileId],
          }),
          queryClient.invalidateQueries({
            queryKey: ["moderation", "user-actions", profileId],
          }),
          queryClient.invalidateQueries({
            queryKey: ["moderation", "user-strikes", profileId],
          }),
          queryClient.invalidateQueries({
            queryKey: ["moderation", "user-warnings", profileId],
          }),
        ]
      : []),
  ]);
}

export function formatReportTargetType(type: string) {
  switch (type) {
    case "MESSAGE":
      return "Message";
    case "DIRECT_MESSAGE":
      return "DM";
    case "PROFILE":
      return "Profile";
    case "BOARD":
      return "Board Metadata";
    case "COMMUNITY":
      return "Community";
    case "COMMUNITY_POST":
      return "Community Post";
    default:
      return type;
  }
}

export function getPriorityColor(priority: string) {
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
}

export function getReportStatusColor(status: string) {
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
}
