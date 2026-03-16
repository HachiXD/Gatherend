import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { MemberRole } from "@prisma/client";
import {
  serializeProfileSummary,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";

// No cachear PATCH
export const revalidate = 0;

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Valid roles that can be assigned (OWNER cannot be assigned via this endpoint)
const ASSIGNABLE_ROLES: MemberRole[] = ["ADMIN", "MODERATOR", "GUEST"];

// Role hierarchy (lower index = higher rank)
const ROLE_HIERARCHY: Record<MemberRole, number> = {
  OWNER: 0,
  ADMIN: 1,
  MODERATOR: 2,
  GUEST: 3,
};

// Roles each actor can assign
const ASSIGNABLE_BY_ROLE: Record<MemberRole, MemberRole[]> = {
  OWNER: ["ADMIN", "MODERATOR", "GUEST"],
  ADMIN: ["MODERATOR", "GUEST"],
  MODERATOR: [], // Cannot change roles
  GUEST: [], // Cannot change roles
};

/**
 * PATCH /api/boards/[boardId]/members/[memberId]
 *
 * Change a member's role with proper hierarchy validation:
 * - OWNER can assign: ADMIN, MODERATOR, GUEST to anyone below them
 * - ADMIN can assign: MODERATOR, GUEST to anyone below them (not other ADMINs)
 * - MODERATOR/GUEST cannot change roles
 *
 * Note: For kicking members, use POST /api/boards/[boardId]/kick
 */
export async function PATCH(
  req: Request,
  context: { params: Promise<{ boardId: string; memberId: string }> },
) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    // Auth + Ban check
    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const params = await context.params;
    const { boardId, memberId } = params;

    // UUID validation for boardId
    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json(
        { error: "Invalid or missing Board ID" },
        { status: 400 },
      );
    }

    // UUID validation for memberId
    if (!memberId || !UUID_REGEX.test(memberId)) {
      return NextResponse.json(
        { error: "Invalid or missing Member ID" },
        { status: 400 },
      );
    }

    // Safe body parsing
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Validate body structure
    if (typeof body !== "object" || body === null || !("role" in body)) {
      return NextResponse.json(
        { error: "Missing role in request body" },
        { status: 400 },
      );
    }

    const { role: newRole } = body as { role: unknown };

    // Validate role is a valid MemberRole and assignable
    if (
      typeof newRole !== "string" ||
      !ASSIGNABLE_ROLES.includes(newRole as MemberRole)
    ) {
      return NextResponse.json(
        { error: "Invalid role. Must be ADMIN, MODERATOR, or GUEST" },
        { status: 400 },
      );
    }

    // Execute all logic in a transaction for consistency
    const result = await db.$transaction(async (tx) => {
      // 1. Find the actor (the one making the change)
      const actor = await tx.member.findFirst({
        where: { boardId, profileId: profile.id },
        select: { id: true, role: true },
      });

      if (!actor) {
        throw new Error("NOT_A_MEMBER");
      }

      // 2. Check if actor can assign roles at all
      const rolesActorCanAssign = ASSIGNABLE_BY_ROLE[actor.role];
      if (rolesActorCanAssign.length === 0) {
        throw new Error("FORBIDDEN");
      }

      // 3. Check if actor can assign this specific role
      if (!rolesActorCanAssign.includes(newRole as MemberRole)) {
        throw new Error("CANNOT_ASSIGN_ROLE");
      }

      // 4. Find the target member
      const target = await tx.member.findFirst({
        where: { id: memberId, boardId },
        select: { id: true, role: true, profileId: true },
      });

      if (!target) {
        throw new Error("TARGET_NOT_FOUND");
      }

      // 5. Cannot change your own role
      if (actor.id === target.id) {
        throw new Error("CANNOT_CHANGE_OWN_ROLE");
      }

      // 6. Cannot change OWNER's role
      if (target.role === MemberRole.OWNER) {
        throw new Error("CANNOT_MODIFY_OWNER");
      }

      // 7. Hierarchy check: Actor can only modify members with lower rank
      const actorRank = ROLE_HIERARCHY[actor.role];
      const targetRank = ROLE_HIERARCHY[target.role];

      if (actorRank >= targetRank) {
        throw new Error("INSUFFICIENT_PERMISSIONS");
      }

      // 8. Update the member's role
      await tx.member.update({
        where: { id: target.id },
        data: { role: newRole as MemberRole },
      });

      // 9. Return updated board with members
      return await tx.board.findUnique({
        where: { id: boardId },
        include: {
          members: {
            include: {
              profile: {
                select: {
                  id: true,
                  username: true,
                  discriminator: true,
                  email: true,
                  userId: true,
                  usernameColor: true,
                  profileTags: true,
                  badge: true,
                  usernameFormat: true,
                  longDescription: true,
                  avatarAsset: {
                    select: uploadedAssetSummarySelect,
                  },
                  badgeSticker: {
                    select: {
                      id: true,
                      asset: {
                        select: uploadedAssetSummarySelect,
                      },
                    },
                  },
                },
              },
            },
            orderBy: { role: "asc" },
          },
        },
      });
    });

    return NextResponse.json({
      ...result,
      members: result?.members.map((member) => ({
        ...member,
        profile: serializeProfileSummary(member.profile),
      })),
    });
  } catch (error) {
    // Handle known transaction errors
    if (error instanceof Error) {
      const errorMap: Record<string, { message: string; status: number }> = {
        NOT_A_MEMBER: {
          message: "You are not a member of this board",
          status: 403,
        },
        FORBIDDEN: {
          message: "You don't have permission to change roles",
          status: 403,
        },
        CANNOT_ASSIGN_ROLE: {
          message: "You cannot assign this role",
          status: 403,
        },
        TARGET_NOT_FOUND: { message: "Member not found", status: 404 },
        CANNOT_CHANGE_OWN_ROLE: {
          message: "You cannot change your own role",
          status: 400,
        },
        CANNOT_MODIFY_OWNER: {
          message: "Cannot modify the owner's role",
          status: 403,
        },
        INSUFFICIENT_PERMISSIONS: {
          message: "You can only modify members with lower rank",
          status: 403,
        },
      };

      const mapped = errorMap[error.message];
      if (mapped) {
        return NextResponse.json(
          { error: mapped.message },
          { status: mapped.status },
        );
      }
    }

    console.error("[MEMBERS_ID_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
