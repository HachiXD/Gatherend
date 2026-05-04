import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { expressMemberCache } from "@/lib/redis";
import { removeBoardWarning } from "@/lib/board-moderation";
import { UUID_REGEX } from "@/lib/platform-moderation";
import { isAdmin } from "@/lib/domain";

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

async function notifyMemberUnbanned(boardId: string, profileId: string) {
  try {
    const socketUrl =
      process.env.SOCKET_SERVER_URL || process.env.NEXT_PUBLIC_SOCKET_URL;
    const secret = process.env.INTERNAL_API_SECRET;
    if (!socketUrl || !secret) return;

    await fetch(`${socketUrl}/emit-to-room`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": secret,
      },
      body: JSON.stringify({
        room: `board:${boardId}`,
        event: "board:member-unbanned",
        data: {
          boardId,
          profileId,
          timestamp: Date.now(),
        },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (error) {
    console.error("[NOTIFY_MEMBER_UNBANNED]", error);
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ boardId: string; warningId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.moderation);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const params = await context.params;
    const { boardId, warningId } = params;

    if (
      !boardId ||
      !warningId ||
      !UUID_REGEX.test(boardId) ||
      !UUID_REGEX.test(warningId)
    ) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    const actor = await db.member.findFirst({
      where: { boardId, profileId: profile.id },
      select: { role: true },
    });

    if (!actor) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    if (!isAdmin(actor.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await db.$transaction(async (tx) =>
      removeBoardWarning(tx, {
        warningId,
        issuedById: profile.id,
      }),
    );

    if (result.autoBanned || result.membershipRemoved) {
      await expressMemberCache.invalidate(boardId, result.affectedProfileId);
      expressMemberCache.invalidateBoardIds(result.affectedProfileId);
      notifyBoardMembership(result.affectedProfileId, boardId, "leave");
      notifyMemberBanned(boardId, result.affectedProfileId);
    } else if (result.autoUnbanned) {
      notifyMemberUnbanned(boardId, result.affectedProfileId);
    }

    return NextResponse.json({
      success: true,
      warningRemoved: result.warningRemoved,
      autoUnbanned: result.autoUnbanned,
      autoBanned: result.autoBanned,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "WARNING_NOT_FOUND") {
        return NextResponse.json(
          { error: "Warning not found" },
          { status: 404 },
        );
      }

      if (error.message === "WARNING_ALREADY_REMOVED") {
        return NextResponse.json(
          { error: "Warning already removed" },
          { status: 409 },
        );
      }
    }

    console.error("[BOARD_WARNING_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
