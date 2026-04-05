import type { BoardRiskEvent, Prisma } from "@prisma/client";
import {
  clampRiskPoints,
  getRiskLevelForPoints,
} from "../constants/progression";

export interface BoardRiskTarget {
  id: string;
  riskPoints: number;
  riskLevel: number;
}

export interface AdjustBoardRiskInput {
  boardId?: string;
  board?: BoardRiskTarget;
  delta: number;
  reason: string;
  sourceType?: string | null;
  sourceId?: string | null;
  profileId?: string | null;
  reportId?: string | null;
}

export interface AdjustBoardRiskResult {
  event: BoardRiskEvent | null;
  previousPoints: number;
  nextPoints: number;
  previousLevel: number;
  nextLevel: number;
  appliedDelta: number;
}

async function resolveBoardRiskTarget(
  tx: Prisma.TransactionClient,
  input: AdjustBoardRiskInput,
): Promise<BoardRiskTarget> {
  if (input.board) {
    return input.board;
  }

  if (!input.boardId) {
    throw new Error("BOARD_TARGET_REQUIRED");
  }

  const board = await tx.board.findUnique({
    where: { id: input.boardId },
    select: {
      id: true,
      riskPoints: true,
      riskLevel: true,
    },
  });

  if (!board) {
    throw new Error("BOARD_NOT_FOUND");
  }

  return board;
}

export async function adjustBoardRisk(
  tx: Prisma.TransactionClient,
  input: AdjustBoardRiskInput,
): Promise<AdjustBoardRiskResult> {
  const board = await resolveBoardRiskTarget(tx, input);

  const previousPoints = board.riskPoints;
  const previousLevel = board.riskLevel;
  const nextPoints = clampRiskPoints(previousPoints + input.delta);
  const nextLevel = getRiskLevelForPoints(nextPoints);
  const appliedDelta = nextPoints - previousPoints;

  if (appliedDelta === 0) {
    return {
      event: null,
      previousPoints,
      nextPoints,
      previousLevel,
      nextLevel,
      appliedDelta,
    };
  }

  await tx.board.update({
    where: { id: board.id },
    data: {
      riskPoints: nextPoints,
      riskLevel: nextLevel,
      riskUpdatedAt: new Date(),
    },
  });

  const event = await tx.boardRiskEvent.create({
    data: {
      boardId: board.id,
      delta: appliedDelta,
      reason: input.reason,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      profileId: input.profileId ?? null,
      reportId: input.reportId ?? null,
    },
  });

  return {
    event,
    previousPoints,
    nextPoints,
    previousLevel,
    nextLevel,
    appliedDelta,
  };
}
