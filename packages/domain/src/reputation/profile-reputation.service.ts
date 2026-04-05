import type { Prisma, ProfileReputationEvent } from "@prisma/client";
import { clampReputationScore } from "../constants/progression";

export interface ProfileReputationTarget {
  id: string;
  reputationScore: number;
}

export interface AdjustProfileReputationInput {
  profileId?: string;
  profile?: ProfileReputationTarget;
  delta: number;
  reason: string;
  sourceType?: string | null;
  sourceId?: string | null;
  boardId?: string | null;
  reportId?: string | null;
}

export interface AdjustProfileReputationResult {
  event: ProfileReputationEvent | null;
  previousScore: number;
  nextScore: number;
  appliedDelta: number;
}

async function resolveProfileReputationTarget(
  tx: Prisma.TransactionClient,
  input: AdjustProfileReputationInput,
): Promise<ProfileReputationTarget> {
  if (input.profile) {
    return input.profile;
  }

  if (!input.profileId) {
    throw new Error("PROFILE_TARGET_REQUIRED");
  }

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

  return profile;
}

export async function adjustProfileReputation(
  tx: Prisma.TransactionClient,
  input: AdjustProfileReputationInput,
): Promise<AdjustProfileReputationResult> {
  const profile = await resolveProfileReputationTarget(tx, input);

  const previousScore = profile.reputationScore;
  const nextScore = clampReputationScore(previousScore + input.delta);
  const appliedDelta = nextScore - previousScore;

  if (appliedDelta === 0) {
    return {
      event: null,
      previousScore,
      nextScore,
      appliedDelta,
    };
  }

  await tx.profile.update({
    where: { id: profile.id },
    data: {
      reputationScore: nextScore,
      reputationUpdatedAt: new Date(),
    },
  });

  const event = await tx.profileReputationEvent.create({
    data: {
      profileId: profile.id,
      delta: appliedDelta,
      reason: input.reason,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      boardId: input.boardId ?? null,
      reportId: input.reportId ?? null,
    },
  });

  return {
    event,
    previousScore,
    nextScore,
    appliedDelta,
  };
}
