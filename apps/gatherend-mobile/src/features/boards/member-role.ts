/**
 * Member role policy for mobile.
 * Uses plain strings — mobile does not depend on @prisma/client.
 * Keep in sync with packages/domain/src/roles/member-role.policy.ts.
 */

export type MemberRole = "OWNER" | "ADMIN" | "MODERATOR" | "GUEST";
export type MemberPermission = "WRITE_WIKI";

/** Numeric rank — lower = higher authority. */
export const ROLE_HIERARCHY: Record<MemberRole, number> = {
  OWNER: 0,
  ADMIN: 1,
  MODERATOR: 2,
  GUEST: 3,
};

/** Roles that can be assigned via the role-change endpoint (OWNER is excluded). */
export const ASSIGNABLE_ROLES: MemberRole[] = ["ADMIN", "MODERATOR", "GUEST"];

/** Which roles each actor level is allowed to assign. */
export const ASSIGNABLE_BY_ROLE: Record<MemberRole, MemberRole[]> = {
  OWNER: ["ADMIN", "MODERATOR", "GUEST"],
  ADMIN: ["MODERATOR", "GUEST"],
  MODERATOR: [],
  GUEST: [],
};

/** Roles that have moderation privileges (can delete messages, pin, etc.). */
export const MODERATOR_ROLES: ReadonlySet<MemberRole> = new Set([
  "OWNER",
  "ADMIN",
  "MODERATOR",
]);

/** Roles that can kick members from a board. */
export const CAN_KICK_ROLES: ReadonlySet<MemberRole> = new Set([
  "OWNER",
  "ADMIN",
  "MODERATOR",
]);

/** Whether a role has moderation privileges. */
export function isModerator(role: string | null | undefined): boolean {
  return role != null && MODERATOR_ROLES.has(role as MemberRole);
}

/** Whether a role is the board owner. */
export function isOwner(role: string | null | undefined): boolean {
  return role === "OWNER";
}

/** Whether a role has admin-level authority (OWNER or ADMIN). */
export function isAdmin(role: string | null | undefined): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/** Whether a role can kick members. */
export function canKick(role: string | null | undefined): boolean {
  return role != null && CAN_KICK_ROLES.has(role as MemberRole);
}

/** Whether a role can ban members from a board. */
export function canBan(role: string | null | undefined): boolean {
  return isAdmin(role);
}

/** Whether a role can warn members. */
export function canWarn(role: string | null | undefined): boolean {
  return isAdmin(role);
}

/**
 * Whether `actor` outranks `target` (strictly higher authority).
 * Used to prevent modifying peers or superiors.
 */
export function outranks(
  actor: string | null | undefined,
  target: string | null | undefined,
): boolean {
  if (actor == null || target == null) return false;
  const actorRank = ROLE_HIERARCHY[actor as MemberRole];
  const targetRank = ROLE_HIERARCHY[target as MemberRole];
  if (actorRank == null || targetRank == null) return false;
  return actorRank < targetRank;
}

/**
 * Returns the roles that `actor` is allowed to assign.
 * Empty array means no assignment permission.
 */
export function assignableBy(role: string | null | undefined): MemberRole[] {
  if (role == null) return [];
  return ASSIGNABLE_BY_ROLE[role as MemberRole] ?? [];
}

/** Whether `actor` can assign `targetRole` to someone. */
export function canAssignRole(
  actor: string | null | undefined,
  targetRole: string | null | undefined,
): boolean {
  if (actor == null || targetRole == null) return false;
  return (ASSIGNABLE_BY_ROLE[actor as MemberRole] ?? []).includes(
    targetRole as MemberRole,
  );
}

/**
 * Whether a member can write wiki pages.
 * OWNER and ADMIN have this implicitly by rank; other roles require the WRITE_WIKI permission.
 */
export function canWriteWiki(
  role: string | null | undefined,
  permissions: MemberPermission[],
): boolean {
  if (isAdmin(role)) return true;
  return permissions.includes("WRITE_WIKI");
}
