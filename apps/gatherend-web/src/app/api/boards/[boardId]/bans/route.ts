import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { MemberRole } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import {
  serializeUploadedAsset,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// No cachear GET requests
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  req: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.moderationRead);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const params = await context.params;

    const boardId = params.boardId;

    // Validate UUID
    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    // Query unificada: obtener board con el member del actor y los bans
    const board = await db.board.findUnique({
      where: { id: boardId },
      include: {
        members: {
          where: { profileId: profile.id },
          select: { role: true },
          take: 1,
        },
        boardBans: {
          include: {
            profile: {
              select: {
                id: true,
                username: true,
                discriminator: true,
                avatarAsset: {
                  select: uploadedAssetSummarySelect,
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    // Validaciones con early return (no hay transacción)
    const member = board?.members[0];

    if (!member) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    if (member.role !== MemberRole.OWNER && member.role !== MemberRole.ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      board.boardBans.map((ban) => ({
        ...ban,
        profile: {
          ...ban.profile,
          avatarAsset: serializeUploadedAsset(ban.profile.avatarAsset),
        },
      })),
    );
  } catch (error) {
    console.error("[GET_BANS]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
