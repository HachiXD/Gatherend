import { NextResponse } from "next/server";
import type { AccessDecision } from "@/lib/domain";
import { REPUTATION_LIMITS } from "@/lib/domain";

export function getProfileReputationScore(
  reputationScore: number | undefined,
): number {
  return typeof reputationScore === "number"
    ? reputationScore
    : REPUTATION_LIMITS.baseline;
}

export function createAccessDeniedResponse(decision: AccessDecision) {
  if (decision.code === "INSUFFICIENT_LEVEL") {
    return NextResponse.json(
      {
        error: "INSUFFICIENT_LEVEL",
        requiredLevel: decision.requiredLevel ?? null,
      },
      { status: 403 },
    );
  }

  return NextResponse.json(
    {
      error: "INSUFFICIENT_REPUTATION",
      requiredReputation: decision.requiredReputation ?? null,
    },
    { status: 403 },
  );
}
