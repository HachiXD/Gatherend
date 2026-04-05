import { db } from "@/lib/db";
import { profileCache } from "@/lib/redis";
import {
  adjustBoardRisk,
  adjustProfileReputation,
  BOARD_RISK_DELTAS,
  PROFILE_REPUTATION_DELTAS,
} from "@/lib/domain";
import { UUID_REGEX } from "@/lib/uploaded-assets";
import {
  AuthProvider,
  PlatformBanSourceType,
  PlatformModerationActionType,
  PlatformWarningStatus,
  StrikeSourceType,
  Prisma,
  type Report,
} from "@prisma/client";

export { UUID_REGEX };

export const REPORT_FILTERS = ["pending", "resolved", "all"] as const;
export type ModerationReportFilter = (typeof REPORT_FILTERS)[number];

export const STRIKE_FILTERS = ["active", "expired", "all"] as const;
export type ModerationStrikeFilter = (typeof STRIKE_FILTERS)[number];

export const MODERATION_CURSOR_MAX_LENGTH = 128;
export const DEFAULT_CURSOR_LIMIT = 20;
export const MAX_CURSOR_LIMIT = 100;
export const WARNING_THRESHOLD = 3;
export const STRIKE_THRESHOLD = 3;
export const WARNING_ESCALATION_STRIKE_SEVERITY = "LOW";
export const DIRECT_STRIKE_DEFAULT_SEVERITY = "MEDIUM";

const REPORT_PRIORITY_ORDER = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
} as const;

export function getReportPriorityWeight(priority: string): number {
  return (
    REPORT_PRIORITY_ORDER[priority as keyof typeof REPORT_PRIORITY_ORDER] ??
    Number.MAX_SAFE_INTEGER
  );
}

export function getStrikeSeverityForReportPriority(priority: string): string {
  switch (priority) {
    case "urgent":
      return "CRITICAL";
    case "high":
      return "HIGH";
    case "medium":
      return "MEDIUM";
    default:
      return "LOW";
  }
}

export function getBoardRiskDeltaForReportPriority(priority: string): number {
  switch (priority) {
    case "urgent":
      return BOARD_RISK_DELTAS.validReportHigh;
    case "high":
      return BOARD_RISK_DELTAS.validReportHigh;
    case "medium":
      return BOARD_RISK_DELTAS.validReportMedium;
    default:
      return BOARD_RISK_DELTAS.validReportLow;
  }
}

export function getBoardRiskDeltaForStrikeSeverity(severity: string): number {
  switch (severity) {
    case "CRITICAL":
      return BOARD_RISK_DELTAS.strikeCritical;
    case "HIGH":
      return BOARD_RISK_DELTAS.strikeHigh;
    case "MEDIUM":
      return BOARD_RISK_DELTAS.strikeMedium;
    default:
      return BOARD_RISK_DELTAS.strikeLow;
  }
}

export function getReputationDeltaForStrikeSeverity(severity: string): number {
  switch (severity) {
    case "CRITICAL":
      return PROFILE_REPUTATION_DELTAS.strikeCritical;
    case "HIGH":
      return PROFILE_REPUTATION_DELTAS.strikeHigh;
    case "MEDIUM":
      return PROFILE_REPUTATION_DELTAS.strikeMedium;
    default:
      return PROFILE_REPUTATION_DELTAS.strikeLow;
  }
}

export function getSafePagination(
  pageParam: string | null,
  limitParam: string | null,
) {
  const pageParsed = Number.parseInt(pageParam ?? "1", 10);
  const limitParsed = Number.parseInt(limitParam ?? "20", 10);

  return {
    page: Number.isNaN(pageParsed) || pageParsed < 1 ? 1 : pageParsed,
    limit: Number.isNaN(limitParsed)
      ? 20
      : Math.min(Math.max(limitParsed, 1), 100),
  };
}

export function getSafeCursorLimit(limitParam: string | null) {
  const parsedLimit = Number.parseInt(limitParam ?? String(DEFAULT_CURSOR_LIMIT), 10);

  return Math.min(
    Number.isNaN(parsedLimit) ? DEFAULT_CURSOR_LIMIT : parsedLimit,
    MAX_CURSOR_LIMIT,
  );
}

export function parseDateCursor(cursorParam: string | null): {
  createdAt: Date;
  id: string;
} | null {
  if (!cursorParam) {
    return null;
  }

  if (cursorParam.length > MODERATION_CURSOR_MAX_LENGTH) {
    throw new Error("INVALID_CURSOR");
  }

  const [createdAtStr, id] = cursorParam.split("|");

  if (!createdAtStr || !id || !UUID_REGEX.test(id)) {
    throw new Error("INVALID_CURSOR");
  }

  const createdAt = new Date(createdAtStr);

  if (Number.isNaN(createdAt.getTime())) {
    throw new Error("INVALID_CURSOR");
  }

  return { createdAt, id };
}

export function buildDateCursor(input: { createdAt: Date; id: string }) {
  return `${input.createdAt.toISOString()}|${input.id}`;
}

export function parseReportQueueCursor(cursorParam: string | null): {
  priorityWeight: number;
  createdAt: Date;
  id: string;
} | null {
  if (!cursorParam) {
    return null;
  }

  if (cursorParam.length > MODERATION_CURSOR_MAX_LENGTH) {
    throw new Error("INVALID_CURSOR");
  }

  const [priorityWeightStr, createdAtStr, id] = cursorParam.split("|");

  if (!priorityWeightStr || !createdAtStr || !id || !UUID_REGEX.test(id)) {
    throw new Error("INVALID_CURSOR");
  }

  const priorityWeight = Number.parseInt(priorityWeightStr, 10);
  const createdAt = new Date(createdAtStr);

  if (
    Number.isNaN(priorityWeight) ||
    priorityWeight < 0 ||
    Number.isNaN(createdAt.getTime())
  ) {
    throw new Error("INVALID_CURSOR");
  }

  return { priorityWeight, createdAt, id };
}

export function buildReportQueueCursor(input: {
  priorityWeight: number;
  createdAt: Date;
  id: string;
}) {
  return `${input.priorityWeight}|${input.createdAt.toISOString()}|${input.id}`;
}

export function getActiveStrikeWhere(profileId: string): Prisma.StrikeWhereInput {
  return {
    profileId,
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  };
}

export function getRevertedReputationDeltaForStrikeSeverity(severity: string): number {
  return -getReputationDeltaForStrikeSeverity(severity);
}

export async function invalidateModeratedProfileCaches(profile: {
  id: string;
  userId: string;
}) {
  await profileCache.invalidate(profile.userId);

  const identities = await db.authIdentity.findMany({
    where: { profileId: profile.id },
    select: { provider: true, providerUserId: true },
  });

  for (const identity of identities) {
    const cacheKey =
      identity.provider === AuthProvider.BETTER_AUTH
        ? `betterauth:${identity.providerUserId}`
        : identity.providerUserId;

    await profileCache.invalidate(cacheKey);
  }
}

export async function revokeBetterAuthSessions(profileId: string): Promise<void> {
  const identity = await db.authIdentity.findFirst({
    where: {
      profileId,
      provider: AuthProvider.BETTER_AUTH,
    },
    select: { providerUserId: true },
  });

  if (!identity) {
    return;
  }

  await db.session.deleteMany({
    where: { userId: identity.providerUserId },
  });
}

export async function incrementReporterStats(
  tx: Prisma.TransactionClient,
  input: {
    reporterId: string | null;
    validDelta?: number;
    falseDelta?: number;
    applyReputationDelta?: number;
    reportId?: string | null;
    boardId?: string | null;
  },
) {
  if (!input.reporterId) {
    return;
  }

  const validDelta = input.validDelta ?? 0;
  const falseDelta = input.falseDelta ?? 0;

  if (validDelta !== 0 || falseDelta !== 0) {
    await tx.profile.update({
      where: { id: input.reporterId },
      data: {
        validReports: validDelta === 0 ? undefined : { increment: validDelta },
        falseReports: falseDelta === 0 ? undefined : { increment: falseDelta },
      },
    });
  }

  if (input.applyReputationDelta && input.applyReputationDelta !== 0) {
    await adjustProfileReputation(tx, {
      profileId: input.reporterId,
      delta: input.applyReputationDelta,
      reason:
        input.applyReputationDelta > 0 ? "VALID_REPORT" : "FALSE_REPORT",
      sourceType: "REPORT",
      sourceId: input.reportId ?? null,
      boardId: input.boardId ?? null,
      reportId: input.reportId ?? null,
    });
  }

  const reporter = await tx.profile.findUnique({
    where: { id: input.reporterId },
    select: { validReports: true, falseReports: true },
  });

  if (!reporter) {
    return;
  }

  const total = reporter.validReports + reporter.falseReports;
  const accuracy = total > 0 ? reporter.validReports / total : null;

  await tx.profile.update({
    where: { id: input.reporterId },
    data: { reportAccuracy: accuracy },
  });
}

export async function applyBoardRiskFromValidatedReport(
  tx: Prisma.TransactionClient,
  report: Pick<Report, "id" | "boardId" | "priority" | "targetOwnerId">,
) {
  if (!report.boardId) {
    return;
  }

  await adjustBoardRisk(tx, {
    boardId: report.boardId,
    delta: getBoardRiskDeltaForReportPriority(report.priority),
    reason: `VALID_REPORT_${report.priority.toUpperCase()}`,
    sourceType: "REPORT",
    sourceId: report.id,
    profileId: report.targetOwnerId ?? null,
    reportId: report.id,
  });
}

export async function applyBoardRiskFromStrike(
  tx: Prisma.TransactionClient,
  input: {
    boardId: string | null;
    severity: string;
    targetProfileId?: string | null;
    reportId?: string | null;
    sourceId?: string | null;
  },
) {
  if (!input.boardId) {
    return;
  }

  await adjustBoardRisk(tx, {
    boardId: input.boardId,
    delta: getBoardRiskDeltaForStrikeSeverity(input.severity),
    reason: `STRIKE_${input.severity}`,
    sourceType: "STRIKE",
    sourceId: input.sourceId ?? input.reportId ?? null,
    profileId: input.targetProfileId ?? null,
    reportId: input.reportId ?? null,
  });
}

export async function syncPlatformAutoBanState(
  tx: Prisma.TransactionClient,
  input: {
    profileId: string;
    issuedById: string;
    notes?: string | null;
    triggeringStrikeId?: string | null;
  },
) {
  const [profile, activeStrikeCount] = await Promise.all([
    tx.profile.findUnique({
      where: { id: input.profileId },
      select: {
        id: true,
        banned: true,
        banSourceType: true,
      },
    }),
    tx.strike.count({
      where: getActiveStrikeWhere(input.profileId),
    }),
  ]);

  if (!profile) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  if (activeStrikeCount >= STRIKE_THRESHOLD) {
    if (profile.banned) {
      return { autoBanned: false, autoUnbanned: false, activeStrikeCount };
    }

    await tx.profile.update({
      where: { id: profile.id },
      data: {
        banned: true,
        bannedAt: new Date(),
        banReason: `Automatically banned after reaching ${STRIKE_THRESHOLD} active strikes`,
        banSourceType: PlatformBanSourceType.AUTO_STRIKE_THRESHOLD,
      },
    });

    await tx.platformModerationAction.create({
      data: {
        profileId: profile.id,
        issuedById: input.issuedById,
        actionType: PlatformModerationActionType.AUTO_BAN,
        strikeId: input.triggeringStrikeId ?? null,
        notes:
          input.notes?.trim() ||
          `Automatically banned after reaching ${STRIKE_THRESHOLD} active strikes`,
      },
    });

    if (input.triggeringStrikeId) {
      await tx.strike.update({
        where: { id: input.triggeringStrikeId },
        data: { autoBanTriggered: true },
      });
    }

    return { autoBanned: true, autoUnbanned: false, activeStrikeCount };
  }

  if (
    profile.banned &&
    profile.banSourceType === PlatformBanSourceType.AUTO_STRIKE_THRESHOLD
  ) {
    await tx.profile.update({
      where: { id: profile.id },
      data: {
        banned: false,
        bannedAt: null,
        banReason: null,
        banSourceType: null,
      },
    });

    await tx.platformModerationAction.create({
      data: {
        profileId: profile.id,
        issuedById: input.issuedById,
        actionType: PlatformModerationActionType.AUTO_UNBAN,
        notes:
          input.notes?.trim() ||
          `Automatically unbanned after falling below ${STRIKE_THRESHOLD} active strikes`,
      },
    });

    return { autoBanned: false, autoUnbanned: true, activeStrikeCount };
  }

  return { autoBanned: false, autoUnbanned: false, activeStrikeCount };
}

export async function issuePlatformStrike(
  tx: Prisma.TransactionClient,
  input: {
    profileId: string;
    issuedById: string;
    reason: string;
    severity?: string | null;
    notes?: string | null;
    reportId?: string | null;
    boardId?: string | null;
    snapshot?: Prisma.InputJsonValue | null;
    contentType?: string | null;
    sourceType?: StrikeSourceType;
    originReportId?: string | null;
    applyReputationDelta?: boolean;
  },
) {
  const profile = await tx.profile.findUnique({
    where: { id: input.profileId },
    select: {
      id: true,
      reputationScore: true,
    },
  });

  if (!profile) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  const severity = input.severity?.trim() || DIRECT_STRIKE_DEFAULT_SEVERITY;
  const sourceType = input.sourceType ?? StrikeSourceType.DIRECT;

  const strike = await tx.strike.create({
    data: {
      profileId: input.profileId,
      boardId: input.boardId ?? null,
      sourceType,
      reason: input.reason,
      severity,
      contentType: input.contentType ?? "manual",
      snapshot: input.snapshot ?? Prisma.JsonNull,
      originReportId: input.originReportId ?? null,
      autoDetected: false,
    },
    select: {
      id: true,
      severity: true,
      profileId: true,
      boardId: true,
      originReportId: true,
      sourceType: true,
    },
  });

  await tx.platformModerationAction.create({
    data: {
      profileId: input.profileId,
      issuedById: input.issuedById,
      actionType: PlatformModerationActionType.STRIKE,
      reportId: input.reportId ?? input.originReportId ?? null,
      strikeId: strike.id,
      notes: input.notes?.trim() || null,
    },
  });

  if (input.applyReputationDelta !== false) {
    await adjustProfileReputation(tx, {
      profile,
      delta: getReputationDeltaForStrikeSeverity(strike.severity),
      reason: `STRIKE_${strike.severity}`,
      sourceType: "STRIKE",
      sourceId: strike.id,
      boardId: strike.boardId,
      reportId: strike.originReportId,
    });
  }

  if (strike.boardId) {
    await applyBoardRiskFromStrike(tx, {
      boardId: strike.boardId,
      severity: strike.severity,
      targetProfileId: strike.profileId,
      reportId: strike.originReportId,
      sourceId: strike.id,
    });
  }

  const autoBanResult = await syncPlatformAutoBanState(tx, {
    profileId: input.profileId,
    issuedById: input.issuedById,
    notes: input.notes ?? null,
    triggeringStrikeId: strike.id,
  });

  return {
    strike,
    ...autoBanResult,
  };
}

async function promoteWarningsToStrikes(
  tx: Prisma.TransactionClient,
  input: {
    profileId: string;
    issuedById: string;
    notes?: string | null;
  },
) {
  const promotedStrikeIds: string[] = [];

  while (true) {
    const activeWarnings = await tx.platformWarning.findMany({
      where: {
        profileId: input.profileId,
        status: PlatformWarningStatus.ACTIVE,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: WARNING_THRESHOLD,
      select: {
        id: true,
        reportId: true,
      },
    });

    if (activeWarnings.length < WARNING_THRESHOLD) {
      break;
    }

    const warningIds = activeWarnings.map((warning) => warning.id);

    const strikeResult = await issuePlatformStrike(tx, {
      profileId: input.profileId,
      issuedById: input.issuedById,
      reason: `Automatically escalated after ${WARNING_THRESHOLD} warnings`,
      severity: WARNING_ESCALATION_STRIKE_SEVERITY,
      notes:
        input.notes?.trim() ||
        `Automatically escalated from ${WARNING_THRESHOLD} warnings`,
      sourceType: StrikeSourceType.WARNING_ESCALATION,
      contentType: "warning_escalation",
      applyReputationDelta: true,
      snapshot: { warningIds },
    });

    await tx.platformWarning.updateMany({
      where: {
        id: { in: warningIds },
      },
      data: {
        status: PlatformWarningStatus.PROMOTED,
        promotedToStrikeId: strikeResult.strike.id,
        removedAt: null,
        removedById: null,
      },
    });

    promotedStrikeIds.push(strikeResult.strike.id);
  }

  return promotedStrikeIds;
}

export async function issuePlatformWarning(
  tx: Prisma.TransactionClient,
  input: {
    profileId: string;
    issuedById: string;
    reason: string;
    notes?: string | null;
    reportId?: string | null;
  },
) {
  const warning = await tx.platformWarning.create({
    data: {
      profileId: input.profileId,
      issuedById: input.issuedById,
      reportId: input.reportId ?? null,
      reason: input.reason,
      notes: input.notes?.trim() || null,
      status: PlatformWarningStatus.ACTIVE,
    },
  });

  await tx.platformModerationAction.create({
    data: {
      profileId: input.profileId,
      issuedById: input.issuedById,
      actionType: PlatformModerationActionType.WARNING,
      reportId: input.reportId ?? null,
      warningId: warning.id,
      notes: input.notes?.trim() || null,
    },
  });

  const promotedStrikeIds = await promoteWarningsToStrikes(tx, {
    profileId: input.profileId,
    issuedById: input.issuedById,
    notes: input.notes ?? null,
  });

  return {
    warning,
    promotedStrikeIds,
  };
}

export async function removePlatformStrike(
  tx: Prisma.TransactionClient,
  input: {
    strikeId: string;
    issuedById: string;
    notes?: string | null;
  },
) {
  const strike = await tx.strike.findUnique({
    where: { id: input.strikeId },
    select: {
      id: true,
      profileId: true,
      sourceType: true,
      severity: true,
      reason: true,
    },
  });

  if (!strike) {
    throw new Error("STRIKE_NOT_FOUND");
  }

  if (strike.sourceType === StrikeSourceType.WARNING_ESCALATION) {
    throw new Error("STRIKE_FROM_WARNINGS");
  }

  const profile = await tx.profile.findUnique({
    where: { id: strike.profileId },
    select: {
      id: true,
      reputationScore: true,
    },
  });

  if (!profile) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  await tx.platformModerationAction.create({
    data: {
      profileId: strike.profileId,
      issuedById: input.issuedById,
      actionType: PlatformModerationActionType.REMOVE_STRIKE,
      strikeId: strike.id,
      notes: input.notes?.trim() || `Removed strike: ${strike.reason}`,
    },
  });

  await tx.strike.delete({
    where: { id: strike.id },
  });

  await adjustProfileReputation(tx, {
    profile,
    delta: getRevertedReputationDeltaForStrikeSeverity(strike.severity),
    reason: `REMOVE_STRIKE_${strike.severity}`,
    sourceType: "STRIKE",
    sourceId: strike.id,
  });

  const autoBanResult = await syncPlatformAutoBanState(tx, {
    profileId: strike.profileId,
    issuedById: input.issuedById,
    notes: input.notes ?? null,
  });

  return {
    strike,
    ...autoBanResult,
  };
}

export async function removePlatformWarning(
  tx: Prisma.TransactionClient,
  input: {
    warningId: string;
    issuedById: string;
    notes?: string | null;
  },
) {
  const warning = await tx.platformWarning.findUnique({
    where: { id: input.warningId },
    select: {
      id: true,
      profileId: true,
      status: true,
      reason: true,
      promotedToStrikeId: true,
    },
  });

  if (!warning) {
    throw new Error("WARNING_NOT_FOUND");
  }

  if (warning.status === PlatformWarningStatus.REMOVED) {
    throw new Error("WARNING_ALREADY_REMOVED");
  }

  await tx.platformModerationAction.create({
    data: {
      profileId: warning.profileId,
      issuedById: input.issuedById,
      actionType: PlatformModerationActionType.REMOVE_WARNING,
      warningId: warning.id,
      notes: input.notes?.trim() || `Removed warning: ${warning.reason}`,
    },
  });

  if (warning.status === PlatformWarningStatus.ACTIVE) {
    await tx.platformWarning.update({
      where: { id: warning.id },
      data: {
        status: PlatformWarningStatus.REMOVED,
        removedAt: new Date(),
        removedById: input.issuedById,
      },
    });

    return { warningRemoved: true, strikeRemoved: false };
  }

  const promotedStrikeId = warning.promotedToStrikeId;

  if (!promotedStrikeId) {
    await tx.platformWarning.update({
      where: { id: warning.id },
      data: {
        status: PlatformWarningStatus.REMOVED,
        removedAt: new Date(),
        removedById: input.issuedById,
      },
    });

    return { warningRemoved: true, strikeRemoved: false };
  }

  const promotedStrike = await tx.strike.findUnique({
    where: { id: promotedStrikeId },
    select: {
      id: true,
      profileId: true,
      severity: true,
      reason: true,
    },
  });

  const siblingWarnings = await tx.platformWarning.findMany({
    where: {
      promotedToStrikeId: promotedStrikeId,
      status: PlatformWarningStatus.PROMOTED,
      NOT: { id: warning.id },
    },
    select: { id: true },
  });

  await tx.platformWarning.update({
    where: { id: warning.id },
    data: {
      status: PlatformWarningStatus.REMOVED,
      removedAt: new Date(),
      removedById: input.issuedById,
      promotedToStrikeId: null,
    },
  });

  if (siblingWarnings.length > 0) {
    await tx.platformWarning.updateMany({
      where: {
        id: {
          in: siblingWarnings.map((sibling) => sibling.id),
        },
      },
      data: {
        status: PlatformWarningStatus.ACTIVE,
        promotedToStrikeId: null,
      },
    });
  }

  if (promotedStrike) {
    const profile = await tx.profile.findUnique({
      where: { id: promotedStrike.profileId },
      select: {
        id: true,
        reputationScore: true,
      },
    });

    if (profile) {
      await tx.platformModerationAction.create({
        data: {
          profileId: promotedStrike.profileId,
          issuedById: input.issuedById,
          actionType: PlatformModerationActionType.REMOVE_STRIKE,
          strikeId: promotedStrike.id,
          notes:
            input.notes?.trim() ||
            `Removed warning-escalation strike: ${promotedStrike.reason}`,
        },
      });

      await tx.strike.delete({
        where: { id: promotedStrike.id },
      });

      await adjustProfileReputation(tx, {
        profile,
        delta: getRevertedReputationDeltaForStrikeSeverity(promotedStrike.severity),
        reason: `REMOVE_STRIKE_${promotedStrike.severity}`,
        sourceType: "STRIKE",
        sourceId: promotedStrike.id,
      });

      await syncPlatformAutoBanState(tx, {
        profileId: promotedStrike.profileId,
        issuedById: input.issuedById,
        notes: input.notes ?? null,
      });

      await promoteWarningsToStrikes(tx, {
        profileId: promotedStrike.profileId,
        issuedById: input.issuedById,
        notes: input.notes ?? null,
      });
    }
  }

  return { warningRemoved: true, strikeRemoved: Boolean(promotedStrike) };
}
