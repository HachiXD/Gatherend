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
  input: LevelAndReputationInput,
): AccessDecision {
  return requireLevelAndReputation(
    input,
    MEMBER_LEVEL_GATES.textComment,
    REPUTATION_GATES.textComment,
  );
}

export function canCreateTextPost(input: LevelAndReputationInput): AccessDecision {
  return requireLevelAndReputation(
    input,
    MEMBER_LEVEL_GATES.textPost,
    REPUTATION_GATES.textPost,
  );
}

export function canCreateCommentWithImage(
  input: LevelAndReputationInput,
): AccessDecision {
  return requireLevelAndReputation(
    input,
    MEMBER_LEVEL_GATES.commentImage,
    REPUTATION_GATES.anyImage,
  );
}

export function canCreatePostWithImage(
  input: LevelAndReputationInput,
): AccessDecision {
  return requireLevelAndReputation(
    input,
    MEMBER_LEVEL_GATES.postImage,
    REPUTATION_GATES.anyImage,
  );
}

export function canSendChatImage(input: LevelAndReputationInput): AccessDecision {
  return requireLevelAndReputation(
    input,
    MEMBER_LEVEL_GATES.chatImage,
    REPUTATION_GATES.anyImage,
  );
}

export function canSendSticker(input: LevelAndReputationInput): AccessDecision {
  return requireLevelAndReputation(
    input,
    MEMBER_LEVEL_GATES.sticker,
    REPUTATION_GATES.sticker,
  );
}

export function canSendDirectMessageAttachment(
  reputationScore: number,
): AccessDecision {
  const byReputation = requireReputation(
    reputationScore,
    REPUTATION_GATES.anyImage,
  );

  return byReputation ?? allow();
}

export function canSendDirectMessageSticker(
  reputationScore: number,
): AccessDecision {
  const byReputation = requireReputation(
    reputationScore,
    REPUTATION_GATES.sticker,
  );

  return byReputation ?? allow();
}

export function canCreateBoard(reputationScore: number): AccessDecision {
  const byReputation = requireReputation(
    reputationScore,
    REPUTATION_GATES.createBoard,
  );

  return byReputation ?? allow();
}

export function canSendLinks(reputationScore: number): AccessDecision {
  const byReputation = requireReputation(
    reputationScore,
    REPUTATION_GATES.links,
  );

  return byReputation ?? allow();
}
