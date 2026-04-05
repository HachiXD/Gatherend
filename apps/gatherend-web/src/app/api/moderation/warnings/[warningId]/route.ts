import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  removePlatformWarning,
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
  { params }: { params: Promise<{ warningId: string }> },
) {
  const rateLimitResponse = await checkRateLimit(RATE_LIMITS.moderation);
  if (rateLimitResponse) return rateLimitResponse;

  const admin = await requireAdmin();
  if (!admin.success) return admin.response;

  const { warningId } = await params;

  if (!warningId || !UUID_REGEX.test(warningId)) {
    return NextResponse.json({ error: "Invalid warning ID" }, { status: 400 });
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

  try {
    const result = await db.$transaction(async (tx) =>
      removePlatformWarning(tx, {
        warningId,
        issuedById: admin.profile.id,
        notes: notes?.trim() || null,
      }),
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "WARNING_NOT_FOUND") {
        return NextResponse.json({ error: "Warning not found" }, { status: 404 });
      }

      if (error.message === "WARNING_ALREADY_REMOVED") {
        return NextResponse.json(
          { error: "Warning is already removed" },
          { status: 409 },
        );
      }
    }

    console.error("[MODERATION_WARNING_DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
