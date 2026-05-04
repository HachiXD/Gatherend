import {
  isModerator,
  isAdmin,
  isOwner,
  outranks,
  assignableBy,
} from "../../boards/member-role";
import type { BoardSettingsSection, BoardSettingsTabId } from "../types";

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

export function canViewSettingsSection(
  role: string | null | undefined,
  section: BoardSettingsTabId,
) {
  if (section === "general" || section === "bans" || section === "history") {
    return isAdmin(role);
  }

  if (section === "members") {
    return isModerator(role);
  }

  return isOwner(role);
}

export function getVisibleSettingsSections(role: string | null | undefined) {
  return BOARD_SETTINGS_SECTIONS.filter((section) =>
    canViewSettingsSection(role, section.id),
  );
}

export function canModifyRole(
  actorRole: string | null | undefined,
  targetRole: string | null | undefined,
) {
  return outranks(actorRole, targetRole);
}

export function getAssignableRoles(role: string | null | undefined) {
  return assignableBy(role);
}
