import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { getExpressServerAuthHeaders } from "@/lib/express-server-auth";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BATCH_MESSAGE_IDS = 200;

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;

    const searchParams = req.nextUrl.searchParams;
    const channelId = searchParams.get("channelId");
    const boardId = searchParams.get("boardId");
    const body = await req.json().catch(() => null);
    const rawIds = body?.ids;

    if (!channelId || !UUID_REGEX.test(channelId)) {
      return NextResponse.json(
        { error: "Invalid channel ID" },
        { status: 400 },
      );
    }

    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return NextResponse.json(
        { error: "Ids must be a non-empty array" },
        { status: 400 },
      );
    }

    if (rawIds.length > MAX_BATCH_MESSAGE_IDS) {
      return NextResponse.json(
        { error: "Too many message IDs" },
        { status: 400 },
      );
    }

    if (
      rawIds.some((id) => typeof id !== "string" || !UUID_REGEX.test(id))
    ) {
      return NextResponse.json(
        { error: "Invalid message IDs" },
        { status: 400 },
      );
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/messages/by-ids?channelId=${channelId}&boardId=${boardId}`,
      {
        method: "POST",
        headers: {
          ...(await getExpressServerAuthHeaders(req)),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: [...new Set(rawIds as string[])],
        }),
      },
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        data ?? { error: "Failed to fetch messages" },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[MESSAGES_BY_IDS_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
