import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  removePlatformStrike,
  UUID_REGEX,
} from "@/lib/platform-moderation";

export const dynamic = "force-dynamic";

function isValidOptionalString(
  value: unknown,
  maxLength: number,
): value is string | undefined {
  return (
    value === undefined || (typeof value === "string" && value.length <= maxLength)
  );
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ strikeId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const admin = await requireAdmin();
    if (!admin.success) return admin.response;

    const { strikeId } = await params;

    if (!strikeId || !UUID_REGEX.test(strikeId)) {
      return NextResponse.json({ error: "Invalid strike ID" }, { status: 400 });
    }

    let notes: string | undefined;
    if (req.headers.get("content-length") && req.headers.get("content-length") !== "0") {
      try {
        const body = (await req.json()) as { notes?: unknown };
        if (!isValidOptionalString(body.notes, 2000)) {
          return NextResponse.json(
            { error: "Notes must be 2000 characters or less" },
            { status: 400 },
          );
        }
        notes = body.notes;
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }
    }

    const removedStrike = await db.$transaction(async (tx) =>
      removePlatformStrike(tx, {
        strikeId,
        issuedById: admin.profile.id,
        notes: notes?.trim() || null,
      }),
    );

    return NextResponse.json({
      success: true,
      strikeId: removedStrike.strike.id,
      autoBanned: removedStrike.autoBanned,
      autoUnbanned: removedStrike.autoUnbanned,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "STRIKE_NOT_FOUND") {
        return NextResponse.json({ error: "Strike not found" }, { status: 404 });
      }

      if (error.message === "STRIKE_FROM_WARNINGS") {
        return NextResponse.json(
          {
            error:
              "This strike was generated from warnings and must be reverted by removing the source warnings",
          },
          { status: 409 },
        );
      }
    }

    console.error("[MODERATION_STRIKE_DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
