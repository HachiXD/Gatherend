import type {
  BoardMemberRole,
  BoardSettingsSection,
  BoardSettingsTabId,
} from "../types";

const GENERAL_ROLES = new Set<BoardMemberRole>(["OWNER", "ADMIN"]);
const MEMBER_ROLES = new Set<BoardMemberRole>(["OWNER", "ADMIN", "MODERATOR"]);
const OWNER_ONLY = new Set<BoardMemberRole>(["OWNER"]);

export const BOARD_SETTINGS_SECTIONS: BoardSettingsSection[] = [
  {
    id: "general",
    title: "General",
    description: "Nombre, descripcion, imagen y bump del board.",
    icon: "settings-outline",
    route: "general",
  },
  {
    id: "members",
    title: "Miembros",
    description: "Roles, advertencias, expulsiones y bans.",
    icon: "people-outline",
    route: "members",
  },
  {
    id: "bans",
    title: "Bans",
    description: "Usuarios baneados y acciones de unban.",
    icon: "person-remove-outline",
    route: "bans",
  },
  {
    id: "history",
    title: "Historial de moderacion",
    description: "Registro de acciones de moderacion del board.",
    icon: "receipt-outline",
    route: "history",
  },
  {
    id: "danger",
    title: "Zona de peligro",
    description: "Eliminar el board de forma permanente.",
    icon: "warning-outline",
    route: "danger",
  },
];

export function normalizeRole(role: string | null | undefined) {
  if (
    role === "OWNER" ||
    role === "ADMIN" ||
    role === "MODERATOR" ||
    role === "GUEST"
  ) {
    return role;
  }

  return null;
}

export function canViewSettingsSection(
  role: string | null | undefined,
  section: BoardSettingsTabId,
) {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return false;

  if (section === "general" || section === "bans" || section === "history") {
    return GENERAL_ROLES.has(normalizedRole);
  }

  if (section === "members") {
    return MEMBER_ROLES.has(normalizedRole);
  }

  return OWNER_ONLY.has(normalizedRole);
}

export function getVisibleSettingsSections(role: string | null | undefined) {
  return BOARD_SETTINGS_SECTIONS.filter((section) =>
    canViewSettingsSection(role, section.id),
  );
}

export function canModifyRole(
  actorRole: BoardMemberRole,
  targetRole: BoardMemberRole,
) {
  const hierarchy: Record<BoardMemberRole, number> = {
    OWNER: 0,
    ADMIN: 1,
    MODERATOR: 2,
    GUEST: 3,
  };

  return hierarchy[actorRole] < hierarchy[targetRole];
}

export function getAssignableRoles(role: BoardMemberRole) {
  if (role === "OWNER") return ["ADMIN", "MODERATOR", "GUEST"] as const;
  if (role === "ADMIN") return ["MODERATOR", "GUEST"] as const;
  return [] as const;
}
