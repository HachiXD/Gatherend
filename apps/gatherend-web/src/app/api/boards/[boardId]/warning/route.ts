import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { expressMemberCache } from "@/lib/redis";
import { issueBoardWarning } from "@/lib/board-moderation";
import { UUID_REGEX } from "@/lib/platform-moderation";
import { canWarn, outranks, isOwner } from "@/lib/domain";

async function notifyBoardMembership(
  profileId: string,
  boardId: string,
  action: "join" | "leave",
) {
  try {
    const socketUrl =
      process.env.SOCKET_SERVER_URL || process.env.NEXT_PUBLIC_SOCKET_URL;
    const secret = process.env.INTERNAL_API_SECRET;
    if (!socketUrl || !secret) return;
    await fetch(`${socketUrl}/socket-membership`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": secret,
      },
      body: JSON.stringify({ profileId, boardId, action }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (error) {
    console.error("[NOTIFY_BOARD_MEMBERSHIP]", error);
  }
}

async function notifyMemberBanned(boardId: string, profileId: string) {
  try {
    const socketUrl =
      process.env.SOCKET_SERVER_URL || process.env.NEXT_PUBLIC_SOCKET_URL;
    const secret = process.env.INTERNAL_API_SECRET;
    if (!socketUrl || !secret) return;

    const timestamp = Date.now();

    await Promise.allSettled([
      fetch(`${socketUrl}/emit-to-room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": secret,
        },
        body: JSON.stringify({
          room: `board:${boardId}`,
          event: "board:member-left",
          data: {
            boardId,
            profileId,
            reason: "banned",
            timestamp,
          },
        }),
        signal: AbortSignal.timeout(3000),
      }),
      fetch(`${socketUrl}/emit-to-room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": secret,
        },
        body: JSON.stringify({
          room: `board:${boardId}`,
          event: "board:member-banned",
          data: {
            boardId,
            profileId,
            timestamp,
          },
        }),
        signal: AbortSignal.timeout(3000),
      }),
      fetch(`${socketUrl}/emit-to-room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": secret,
        },
        body: JSON.stringify({
          room: `profile:${profileId}`,
          event: "board:banned",
          data: {
            boardId,
            bannedProfileId: profileId,
            timestamp,
          },
        }),
        signal: AbortSignal.timeout(3000),
      }),
    ]);
  } catch (error) {
    console.error("[NOTIFY_MEMBER_BANNED]", error);
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.moderation);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const params = await context.params;

    let body: { targetProfileId?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const boardId = params.boardId;
    const targetProfileId = body.targetProfileId;

    if (!boardId || typeof targetProfileId !== "string" || !targetProfileId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (!UUID_REGEX.test(boardId) || !UUID_REGEX.test(targetProfileId)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    if (profile.id === targetProfileId) {
      return NextResponse.json(
        { error: "You cannot warn yourself" },
        { status: 400 },
      );
    }

    const result = await db.$transaction(async (tx) => {
      const [actor, targetMember] = await Promise.all([
        tx.member.findFirst({
          where: { boardId, profileId: profile.id },
          select: { role: true },
        }),
        tx.member.findFirst({
          where: { boardId, profileId: targetProfileId },
          select: { role: true },
        }),
      ]);

      if (!actor) {
        throw new Error("NOT_A_MEMBER");
      }

      if (!canWarn(actor.role)) {
        throw new Error("FORBIDDEN");
      }

      if (!targetMember) {
        throw new Error("TARGET_NOT_MEMBER");
      }

      if (isOwner(targetMember.role)) {
        throw new Error("CANNOT_WARN_OWNER");
      }

      if (!outranks(actor.role, targetMember.role)) {
        throw new Error("INSUFFICIENT_PERMISSIONS");
      }

      return issueBoardWarning(tx, {
        boardId,
        profileId: targetProfileId,
        issuedById: profile.id,
      });
    });

    if (result.autoBanned || result.membershipRemoved) {
      await expressMemberCache.invalidate(boardId, targetProfileId);
      expressMemberCache.invalidateBoardIds(targetProfileId);
      notifyBoardMembership(targetProfileId, boardId, "leave");
      notifyMemberBanned(boardId, targetProfileId);
    }

    return NextResponse.json({
      success: true,
      warning: {
        ...result.warning,
        createdAt: result.warning.createdAt.toISOString(),
        updatedAt: result.warning.updatedAt.toISOString(),
        removedAt: result.warning.removedAt?.toISOString() ?? null,
      },
      autoBanned: result.autoBanned,
      autoBanId: result.autoBanId,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_A_MEMBER") {
        return NextResponse.json({ error: "Not a member" }, { status: 403 });
      }

      if (error.message === "FORBIDDEN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (error.message === "TARGET_NOT_MEMBER") {
        return NextResponse.json(
          { error: "User is not a member of this board" },
          { status: 404 },
        );
      }

      if (error.message === "CANNOT_WARN_OWNER") {
        return NextResponse.json(
          { error: "Cannot warn the owner" },
          { status: 403 },
        );
      }

      if (error.message === "INSUFFICIENT_PERMISSIONS") {
        return NextResponse.json(
          { error: "Admins cannot warn other admins" },
          { status: 403 },
        );
      }

      if (error.message === "TARGET_ALREADY_BANNED") {
        return NextResponse.json(
          { error: "User is already banned from this board" },
          { status: 409 },
        );
      }
    }

    console.error("[BOARD_WARNING_CREATE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
