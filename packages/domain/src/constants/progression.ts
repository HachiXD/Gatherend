export const MEMBER_LEVEL_XP_THRESHOLDS = {
  1: 0,
  2: 20,
  3: 60,
  4: 130,
  5: 220,
  6: 420,
  7: 700,
} as const;

export const MEMBER_LEVEL_GATES = {
  textChat: 1,
  textComment: 1,
  textPost: 3,
  commentImage: 5,
  postImage: 6,
  chatImage: 7,
  sticker: 7,
} as const;

export const REPUTATION_LIMITS = {
  min: 0,
  max: 120,
  baseline: 100,
} as const;

export const REPUTATION_GATES = {
  createBoard: 70,
  links: 80,
  textPost: 80,
  textComment: 80,
  anyImage: 90,
  sticker: 90,
} as const;

export const MEMBER_XP_REWARDS = {
  chatText: 4,
  commentText: 6,
  postText: 20,
  chatImage: 4,
  commentImage: 4,
  postImage: 4,
  sticker: 4,
} as const;

export const MEMBER_XP_RULES = {
  minimumTextLength: 10,
  minimumXp: 0,
} as const;

export const PROFILE_REPUTATION_DELTAS = {
  validReport: 2,
  falseReport: -3,
  strikeLow: -8,
  strikeMedium: -15,
  strikeHigh: -30,
  strikeCritical: -100,
  boardBan: -12,
  autoBlockedUpload: -10,
  cleanPeriod7d: 1,
  cleanPeriod30d: 3,
} as const;

export const BOARD_RISK_LIMITS = {
  minPoints: 0,
  maxPoints: 100,
  minimumLevel: 1,
  maximumLevel: 10,
  pointsPerLevel: 10,
} as const;

export const BOARD_RISK_DELTAS = {
  validReportLow: 4,
  validReportMedium: 8,
  validReportHigh: 15,
  strikeLow: 6,
  strikeMedium: 10,
  strikeHigh: 20,
  strikeCritical: 35,
  autoBlockedUpload: 8,
  unhandledReport24h: 10,
  unhandledReport72h: 20,
  platformIntervention: 12,
  recurrencePattern: 8,
  localModerationSuccess: -4,
  fastValidAction: -5,
  cleanPeriod7d: -6,
  cleanPeriod30d: -12,
} as const;

export type MemberLevel = keyof typeof MEMBER_LEVEL_XP_THRESHOLDS;
export type MemberLevelGate = keyof typeof MEMBER_LEVEL_GATES;
export type ReputationGate = keyof typeof REPUTATION_GATES;

export function getLevelForXp(xp: number): number {
  const safeXp = Math.max(MEMBER_XP_RULES.minimumXp, xp);
  let resolvedLevel = 1;

  for (const [levelKey, threshold] of Object.entries(MEMBER_LEVEL_XP_THRESHOLDS)) {
    const level = Number(levelKey);
    if (safeXp >= threshold) {
      resolvedLevel = level;
    }
  }

  return resolvedLevel;
}

export function clampReputationScore(score: number): number {
  return Math.min(
    REPUTATION_LIMITS.max,
    Math.max(REPUTATION_LIMITS.min, score),
  );
}

export function clampRiskPoints(points: number): number {
  return Math.min(
    BOARD_RISK_LIMITS.maxPoints,
    Math.max(BOARD_RISK_LIMITS.minPoints, points),
  );
}

export function getRiskLevelForPoints(points: number): number {
  const safePoints = clampRiskPoints(points);
  const rawLevel = Math.floor(safePoints / BOARD_RISK_LIMITS.pointsPerLevel) + 1;

  return Math.min(
    BOARD_RISK_LIMITS.maximumLevel,
    Math.max(BOARD_RISK_LIMITS.minimumLevel, rawLevel),
  );
}

export function hasMinimumMeaningfulTextLength(content: string): boolean {
  return content.trim().length >= MEMBER_XP_RULES.minimumTextLength;
}
