// app/api/boards/invite-preview/[inviteCode]/route.ts

// Este endpoint es para uso INTERNO de la app.
// Permite renderizar un preview estilizado de la invitación en el frontend.
// Para previews externos,
// usar metadata dinámica en la página /invite/[inviteCode].

import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import {
  serializeUploadedAsset,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";

// UUID validation regex (invite codes are UUIDs generated with uuidv4())
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// No cachear GET requests
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ inviteCode: string }> },
) {
  try {
    // Rate limiting - importante para prevenir invite code enumeration
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.invitePreview);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;

    const { inviteCode } = await params;

    // Validar existencia y formato UUID
    if (!inviteCode || !UUID_REGEX.test(inviteCode)) {
      return NextResponse.json(
        { error: "Invalid invite code" },
        { status: 400 },
      );
    }

    const board = await db.board.findFirst({
      where: { inviteCode },
      select: {
        id: true,
        name: true,
        imageAsset: {
          select: uploadedAssetSummarySelect,
        },
        bannerAsset: {
          select: uploadedAssetSummarySelect,
        },
        inviteEnabled: true,
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    if (!board.inviteEnabled) {
      return NextResponse.json(
        { error: "Invitations disabled" },
        { status: 403 },
      );
    }

    return NextResponse.json({
      id: board.id,
      name: board.name,
      imageAsset: serializeUploadedAsset(board.imageAsset),
      bannerAsset: serializeUploadedAsset(board.bannerAsset),
      memberCount: board._count.members,
      inviteCode,
    });
  } catch (error) {
    console.error("[INVITE_PREVIEW_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
