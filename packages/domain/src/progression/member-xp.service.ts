import type { Prisma, MemberXpEvent } from "@prisma/client";
import { getLevelForXp } from "../constants/progression";

export interface MemberXpTarget {
  id: string;
  profileId: string;
  boardId: string;
  xp: number;
  level: number;
}

export interface AwardMemberXpInput {
  memberId?: string;
  member?: MemberXpTarget;
  profileId?: string;
  boardId?: string;
  delta: number;
  reason: string;
  sourceType?: string | null;
  sourceId?: string | null;
}

export interface AwardMemberXpResult {
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
