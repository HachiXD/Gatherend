import {
  MEMBER_LEVEL_GATES,
  REPUTATION_GATES,
} from "../constants/progression";

export type AccessPolicyCode =
  | "INSUFFICIENT_LEVEL"
  | "INSUFFICIENT_REPUTATION";

export interface AccessDecision {
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

function denyByLevel(requiredLevel: number): AccessDecision {
  return {
    allowed: false,
    code: "INSUFFICIENT_LEVEL",
    requiredLevel,
  };
}

function denyByReputation(requiredReputation: number): AccessDecision {
  return {
    allowed: false,
    code: "INSUFFICIENT_REPUTATION",
    requiredReputation,
  };
}

function requireLevel(
  currentLevel: number,
  requiredLevel: number,
): AccessDecision | null {
  if (currentLevel < requiredLevel) {
    return denyByLevel(requiredLevel);
  }

  return null;
}

function requireReputation(
  reputationScore: number,
  requiredReputation: number,
): AccessDecision | null {
  if (reputationScore < requiredReputation) {
    return denyByReputation(requiredReputation);
  }

  return null;
}

function requireLevelAndReputation(
  input: LevelAndReputationInput,
  requiredLevel: number,
  requiredReputation: number,
): AccessDecision {
  const byLevel = requireLevel(input.level, requiredLevel);
  if (byLevel) return byLevel;

  const byReputation = requireReputation(
    input.reputationScore,
    requiredReputation,
  );
  if (byReputation) return byReputation;

  return allow();
}

export function canSendTextChatMessage(): AccessDecision {
  return allow();
}

export function canCreateTextComment(
  _input: LevelAndReputationInput,
): AccessDecision {
  return allow();
}

export function canCreateTextPost(
  _input: LevelAndReputationInput,
): AccessDecision {
  return allow();
}

export function canCreateCommentWithImage(
  _input: LevelAndReputationInput,
): AccessDecision {
  return allow();
}

export function canCreatePostWithImage(
  _input: LevelAndReputationInput,
): AccessDecision {
  return allow();
}

export function canSendChatImage(
  _input: LevelAndReputationInput,
): AccessDecision {
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

export function canCreateBoard(_reputationScore: number): AccessDecision {
  return allow();
}

export function canSendLinks(_reputationScore: number): AccessDecision {
  return allow();
}
