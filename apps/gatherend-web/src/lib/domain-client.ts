/**
 * Client-safe role helpers.
 *
 * Re-exports policy functions with `MemberRole | undefined` signatures so
 * React components can call them before board data has loaded without
 * adding nullable branches everywhere.
 *
 * API routes and server-side code must import from "@/lib/domain" directly
 * to keep strict typing and prevent accidental undefined checks on the backend.
 */
import { type MemberRole } from "@prisma/client";
import {
  isModerator as _isModerator,
  isAdmin as _isAdmin,
  isOwner as _isOwner,
  canKick as _canKick,
  canBan as _canBan,
  canWarn as _canWarn,
  outranks as _outranks,
  canAssignRole as _canAssignRole,
  assignableBy as _assignableBy,
} from "@/lib/domain";

export const isModerator = (role: MemberRole | undefined): boolean =>
  !!role && _isModerator(role);

export const isAdmin = (role: MemberRole | undefined): boolean =>
  !!role && _isAdmin(role);

export const isOwner = (role: MemberRole | undefined): boolean =>
  !!role && _isOwner(role);

export const canKick = (role: MemberRole | undefined): boolean =>
  !!role && _canKick(role);

export const canBan = (role: MemberRole | undefined): boolean =>
  !!role && _canBan(role);

export const canWarn = (role: MemberRole | undefined): boolean =>
  !!role && _canWarn(role);

export const outranks = (
  actor: MemberRole | undefined,
  target: MemberRole | undefined,
): boolean => !!actor && !!target && _outranks(actor, target);

export const assignableBy = (actor: MemberRole | undefined): MemberRole[] =>
  actor ? _assignableBy(actor) : [];

export const canAssignRole = (
  actor: MemberRole | undefined,
  targetRole: MemberRole | undefined,
): boolean => !!actor && !!targetRole && _canAssignRole(actor, targetRole);
