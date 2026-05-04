import { MemberPermission, MemberRole } from "@prisma/client";

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
export function isModerator(role: MemberRole): boolean {
  return MODERATOR_ROLES.has(role);
}

/** Whether a role is the board owner. */
export function isOwner(role: MemberRole): boolean {
  return role === "OWNER";
}

/** Whether a role can kick members. */
export function canKick(role: MemberRole): boolean {
  return CAN_KICK_ROLES.has(role);
}

/**
 * Whether `actor` has admin-level authority (OWNER or ADMIN).
 * Use for actions restricted to top-tier roles: ban, warn, manage channels, edit rules, etc.
 */
export function isAdmin(role: MemberRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/** Whether a role can ban members from a board. */
export function canBan(role: MemberRole): boolean {
  return isAdmin(role);
}

/** Whether a role can warn members. */
export function canWarn(role: MemberRole): boolean {
  return isAdmin(role);
}

/**
 * Whether `actor` outranks `target` (strictly higher authority).
 * Used to prevent modifying peers or superiors.
 */
export function outranks(actor: MemberRole, target: MemberRole): boolean {
  return ROLE_HIERARCHY[actor] < ROLE_HIERARCHY[target];
}

/**
 * Returns the roles that `actor` is allowed to assign.
 * Empty array means no assignment permission.
 */
export function assignableBy(actor: MemberRole): MemberRole[] {
  return ASSIGNABLE_BY_ROLE[actor];
}

/** Whether `actor` can assign `targetRole` to someone. */
export function canAssignRole(
  actor: MemberRole,
  targetRole: MemberRole,
): boolean {
  return ASSIGNABLE_BY_ROLE[actor].includes(targetRole);
}

/**
 * Whether a member can write wiki pages.
 * OWNER and ADMIN have this implicitly by rank; other roles require the WRITE_WIKI permission.
 */
export function canWriteWiki(
  role: MemberRole,
  permissions: MemberPermission[],
): boolean {
  if (isAdmin(role)) return true;
  return permissions.includes("WRITE_WIKI");
}
