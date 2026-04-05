import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { MemberRole } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { removeBoardBan } from "@/lib/board-moderation";
import { UUID_REGEX } from "@/lib/platform-moderation";

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

    let targetProfileId: unknown;
    try {
      const body = await req.json();
      targetProfileId = body.targetProfileId;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const boardId = params.boardId;

    if (!boardId || typeof targetProfileId !== "string" || !targetProfileId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (!UUID_REGEX.test(boardId) || !UUID_REGEX.test(targetProfileId)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    if (profile.id === targetProfileId) {
      return NextResponse.json(
        { error: "You cannot unban yourself" },
        { status: 400 },
      );
    }

    await db.$transaction(async (tx) => {
      const actor = await tx.member.findFirst({
        where: { boardId, profileId: profile.id },
        select: { role: true },
      });

      if (!actor) {
        throw new Error("NOT_A_MEMBER");
      }

      if (actor.role !== MemberRole.OWNER && actor.role !== MemberRole.ADMIN) {
        throw new Error("FORBIDDEN");
      }

      await removeBoardBan(tx, {
        boardId,
        profileId: targetProfileId,
        issuedById: profile.id,
      });
    });

    notifyMemberUnbanned(boardId, targetProfileId);

    return NextResponse.json({
      success: true,
      unbannedProfileId: targetProfileId,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_A_MEMBER") {
        return NextResponse.json({ error: "Not a member" }, { status: 403 });
      }

      if (error.message === "FORBIDDEN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (error.message === "NOT_BANNED") {
        return NextResponse.json(
          { error: "User is not banned" },
          { status: 400 },
        );
      }
    }

    console.error("[UNBAN_MEMBER]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
