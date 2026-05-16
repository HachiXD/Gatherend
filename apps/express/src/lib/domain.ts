import { MemberRole, type MemberXpEvent, type Prisma } from "@prisma/client";

export const REPUTATION_LIMITS = {
  min: 0,
  max: 120,
  baseline: 100,
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

const MEMBER_XP_RULES = {
  minimumTextLength: 10,
  minimumXp: 0,
} as const;

const MEMBER_LEVEL_XP_THRESHOLDS = {
  1: 0,
  2: 20,
  3: 60,
  4: 130,
  5: 220,
  6: 420,
  7: 700,
} as const;

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/i;

export function containsExternalLinks(content: string): boolean {
  return URL_REGEX.test(content);
}

export function hasMinimumMeaningfulTextLength(content: string): boolean {
  return content.trim().length >= MEMBER_XP_RULES.minimumTextLength;
}

export function isModerator(role: MemberRole): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MODERATOR";
}

type AccessPolicyCode = "INSUFFICIENT_LEVEL" | "INSUFFICIENT_REPUTATION";

interface AccessDecision {
  allowed: boolean;
  code?: AccessPolicyCode;
  requiredLevel?: number;
  requiredReputation?: number;
}

interface LevelAndReputationInput {
  level: number;
  reputationScore: number;
}

function allow(): AccessDecision {
  return { allowed: true };
}

export function canSendChatImage(_input: LevelAndReputationInput): AccessDecision {
  return allow();
}

export function canSendSticker(_input: LevelAndReputationInput): AccessDecision {
  return allow();
}

export function canSendDirectMessageAttachment(
  _reputationScore: number,
): AccessDecision {
  return allow();
}

export function canSendDirectMessageSticker(
  _reputationScore: number,
): AccessDecision {
  return allow();
}

export function canSendLinks(_reputationScore: number): AccessDecision {
  return allow();
}

function getLevelForXp(xp: number): number {
  const safeXp = Math.max(MEMBER_XP_RULES.minimumXp, xp);
  let resolvedLevel = 1;

  for (const [levelKey, threshold] of Object.entries(
    MEMBER_LEVEL_XP_THRESHOLDS,
  )) {
    const level = Number(levelKey);
    if (safeXp >= threshold) {
      resolvedLevel = level;
    }
  }

  return resolvedLevel;
}

interface MemberXpTarget {
  id: string;
  profileId: string;
  boardId: string;
  xp: number;
  level: number;
}

interface AwardMemberXpInput {
  memberId?: string;
  member?: MemberXpTarget;
  profileId?: string;
  boardId?: string;
  delta: number;
  reason: string;
  sourceType?: string | null;
  sourceId?: string | null;
}

interface AwardMemberXpResult {
  event: MemberXpEvent | null;
  previousXp: number;
  nextXp: number;
  previousLevel: number;
  nextLevel: number;
  leveledUp: boolean;
}

async function resolveMemberXpTarget(
  tx: Prisma.TransactionClient,
  input: AwardMemberXpInput,
): Promise<MemberXpTarget> {
  if (input.member) {
    return input.member;
  }

  if (!input.memberId) {
    throw new Error("MEMBER_TARGET_REQUIRED");
  }

  const member = await tx.member.findUnique({
    where: { id: input.memberId },
    select: {
      id: true,
      profileId: true,
      boardId: true,
      xp: true,
      level: true,
    },
  });

  if (!member) {
    throw new Error("MEMBER_NOT_FOUND");
  }

  return member;
}

export async function awardMemberXp(
  tx: Prisma.TransactionClient,
  input: AwardMemberXpInput,
): Promise<AwardMemberXpResult> {
  const member = await resolveMemberXpTarget(tx, input);

  const previousXp = member.xp;
  const previousLevel = member.level;
  const nextXp = Math.max(0, previousXp + input.delta);
  const nextLevel = getLevelForXp(nextXp);
  const appliedDelta = nextXp - previousXp;

  if (appliedDelta === 0) {
    return {
      event: null,
      previousXp,
      nextXp,
      previousLevel,
      nextLevel,
      leveledUp: false,
    };
  }

  const updatedMember = await tx.member.update({
    where: { id: member.id },
    data: {
      xp: nextXp,
      level: nextLevel,
      ...(nextLevel !== previousLevel ? { levelUpdatedAt: new Date() } : {}),
    },
    select: {
      xp: true,
      level: true,
    },
  });

  const event = await tx.memberXpEvent.create({
    data: {
      memberId: member.id,
      profileId: input.profileId ?? member.profileId,
      boardId: input.boardId ?? member.boardId,
      delta: appliedDelta,
      reason: input.reason,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
    },
  });

  return {
    event,
    previousXp,
    nextXp: updatedMember.xp,
    previousLevel,
    nextLevel: updatedMember.level,
    leveledUp: updatedMember.level > previousLevel,
  };
}
