/**
 * Theme System Types
 * Sistema de temas dinámicos para Gatherend
 */

/** Colores generados a partir del color base */
export interface ThemeColors {
  // Backgrounds
  bgPrimary: string; // Fondo principal más oscuro
  bgOverlayPrimary: string; // Fondo de overlays (mismo color que bgPrimary, siempre opaco)
  bgDropdownMenuPrimary: string; // Fondo de dropdown menus (mismo color que bgPrimary, siempre opaco)
  bgSecondary: string; // Fondo secundario
  bgTertiary: string; // Fondo terciario (cards, etc)
  bgQuaternary: string; // Fondo cuaternario (input, chat header)
  bgInputPlus: string; // Fondo del icono Plus en chat input (igual que bgQuaternary pero opaco con degradado)
  bgQuinary: string; // Fondo quinario (main header)
  bgInput: string; // Fondo de inputs

  // Accents
  accentPrimary: string; // Color accent principal
  accentLight: string; // Accent claro
  accentHover: string; // Accent en hover

  // Borders
  borderPrimary: string; // Borde principal
  borderSecondary: string; // Borde secundario

  // Buttons
  buttonPrimary: string; // Botón principal
  buttonPrimaryActive: string; // Variante un poco más luminosa para estados activos
  buttonHover: string; // Botón en hover

  // Text
  textAccent: string; // Texto con color accent
  textMuted: string; // Texto atenuado
  textLight: string; // Texto claro (para avatars, etc)
  textSubtle: string; // Texto sutil (labels secundarios)
  textPrimary: string; // Texto principal (blanco en dark, negro en light)
  textSecondary: string; // Texto secundario
  textTertiary: string; // Texto terciario/placeholder
  textInverse: string; // Texto inverso (negro en dark, blanco en light) - para botones

  // Channels
  channelBg: string; // Fondo de canal
  channelHover: string; // Hover de canal
  channelActive: string; // Active de canal

  // UI Elements
  tooltipBg: string; // Fondo de tooltips
  avatarFallbackBg: string; // Fondo de avatar fallback
  pickerBg: string; // Fondo de emoji/sticker pickers
  pickerBorder: string; // Borde de emoji/sticker pickers
  menuHover: string; // Hover para menús con fondo bg-primary
  menuAccentText: string; // Texto accent para items de menú (invite, etc)
  navActionBg: string; // Fondo del botón de navegación (add board)
  navActionHover: string; // Hover del botón de navegación
  addFriendIcon: string; // Color del icono add friend
  addFriendHover: string; // Hover del icono add friend
  textMutedAlt: string; // Texto muted alternativo (zinc-500)
  tabActiveBg: string; // Fondo del tab activo en settings
  tabButtonBg: string; // Fondo de botones dentro de tabs
  tabButtonHover: string; // Hover de botones dentro de tabs
  communityTabsFallbackBg: string; // Fondo fallback para tabs de comunidad
  communityTabsFallbackActiveBg: string; // Fondo fallback activo para tabs de comunidad

  // Chat Toolbar
  toolbarBg: string; // Fondo del toolbar de chat
  toolbarIcon: string; // Color de iconos del toolbar
  toolbarBorder: string; // Borde del toolbar

  // Dropdown Menu
  dropdownBg: string; // Fondo del dropdown menu
  dropdownBorder: string; // Borde del dropdown menu
  dropdownHover: string; // Hover de items del dropdown

  // Reactions
  reactionActiveBg: string; // Fondo cuando user reaccionó
  reactionActiveBorder: string; // Borde cuando user reaccionó
  reactionActiveText: string; // Texto cuando user reaccionó
  reactionBg: string; // Fondo default de reacción
  reactionBorder: string; // Borde default de reacción
  reactionText: string; // Texto default de reacción

  // Slot Avatar (member slots)
  slotDiscoveryIcon: string; // Color icono BY_DISCOVERY (cyan)
  slotDiscoveryBg: string; // Fondo icono BY_DISCOVERY (cyan con alfa)
  slotInvitationIcon: string; // Color icono BY_INVITATION (amber)
  slotInvitationBg: string; // Fondo icono BY_INVITATION (amber con alfa)
  slotBorder: string; // Borde del slot avatar

  // Modal backgrounds
  bgModal: string; // Fondo de modales (siempre opaco, nunca transparente con gradiente)

  // Modal inputs
  bgInputModal: string; // Fondo de inputs en modales

  // Cancel button
  bgCancelButton: string; // Fondo del botón cancel
  bgCancelButtonHover: string; // Hover del botón cancel

  // Send button (chat input)
  buttonSendHover: string; // Hover del botón send en chat input

  // Chat input icons
  chatInputIcon: string; // Color de iconos del chat input (Plus bg, emoji/sticker text)
  chatInputIconHover: string; // Hover de iconos del chat input
  chatInputButtonBg: string; // Fondo de botones utilitarios del chat input
  chatInputSurfaceBg: string; // Fondo del contenedor de escritura del chat input

  // Channel type buttons (Text/Voice selector)
  channelTypeActiveBorder: string; // Borde del botón activo (verde)
  channelTypeActiveSoftBg: string; // Fondo desaturado derivado del activo
  channelTypeActiveBg: string; // Fondo del botón activo (verde con alfa)
  channelTypeActiveText: string; // Texto del botón activo
  channelTypeInactiveBg: string; // Fondo del botón inactivo
  channelTypeInactiveBorder: string; // Borde del botón inactivo
  channelTypeInactiveHoverBorder: string; // Borde del botón inactivo en hover
  channelTypeInactiveText: string; // Texto del botón inactivo

  // Scrollbars - Navigation Sidebar
  scrollbarNavThumb: string; // Thumb del scrollbar de navegación
  scrollbarNavThumbHover: string; // Hover del thumb de navegación

  // Scrollbars - Main (Discovery Feed + Chat)
  scrollbarMainThumb: string; // Thumb del scrollbar principal
  scrollbarMainThumbHover: string; // Hover del thumb principal

  // App Settings button
  appSettingsHover: string; // Hover del botón de settings en el header

  // Custom User Button
  accentCustomUserButton: string; // Focus ring del avatar button

  // Tab hover (board settings sidebar)
  bgTabHover: string; // Hover de tabs en sidebars de settings

  // Reply preview border
  borderAccentItemReplyPreview: string; // Borde del reply preview en chat

  // Active channel border
  borderAccentActiveChannel: string; // Borde del canal activo en leftbar

  // Edit form background
  bgEditForm: string; // Fondo del formulario de edición en chat

  // Notification / Unread indicators
  notificationBg: string; // Fondo de badges y puntos de notificación (hue complementario al bgPrimary)
  unreadBg: string; // Fondo sutil para estados de no-leído (hue complementario, oscuro)
}

/** Modo del tema: dark o light */
export type ThemeMode = "dark" | "light";

/** Color stop con posición para degradados */
export interface GradientColorStop {
  color: string; // Color hex
  position: number; // Posición 0-100
}

/** Configuración de degradado de fondo */
export interface GradientConfig {
  colors: (string | GradientColorStop)[]; // Array de colores o color stops (mín 2, máx 4)
  angle: number; // Ángulo en grados (0-360)
  type: "linear" | "radial";
}

/** Preset de tema con nombre y color base */
export interface ThemePreset {
  name: string;
  baseColor: string;
}

/**
 * Configuración completa del tema de un usuario
 * Este es el tipo del campo Profile.themeConfig en la DB
 */
export interface ThemeConfig {
  baseColor?: string; // Color base para generar la paleta, null/undefined = default
  gradient?: GradientConfig; // Configuración del degradado de fondo, null/undefined = sin degradado
  mode?: ThemeMode; // Modo del tema: dark (default) o light
}

/** Nombres de las variables CSS del tema */
export type ThemeColorKey = keyof ThemeColors;

/** Mapeo de nombres de colores a variables CSS */
export const THEME_CSS_VAR_MAP: Record<ThemeColorKey, string> = {
  bgPrimary: "--theme-bg-primary",
  bgOverlayPrimary: "--theme-bg-overlay-primary",
  bgDropdownMenuPrimary: "--theme-bg-dropdown-menu-primary",
  bgSecondary: "--theme-bg-secondary",
  bgTertiary: "--theme-bg-tertiary",
  bgQuaternary: "--theme-bg-quaternary",
  bgInputPlus: "--theme-bg-input-plus",
  bgQuinary: "--theme-bg-quinary",
  bgInput: "--theme-bg-input",
  accentPrimary: "--theme-accent-primary",
  accentLight: "--theme-accent-light",
  accentHover: "--theme-accent-hover",
  borderPrimary: "--theme-border-primary",
  borderSecondary: "--theme-border-secondary",
  buttonPrimary: "--theme-button-primary",
  buttonPrimaryActive: "--theme-button-primary-active",
  buttonHover: "--theme-button-hover",
  textAccent: "--theme-text-accent",
  textMuted: "--theme-text-muted",
  textLight: "--theme-text-light",
  textSubtle: "--theme-text-subtle",
  textPrimary: "--theme-text-primary",
  textSecondary: "--theme-text-secondary",
  textTertiary: "--theme-text-tertiary",
  textInverse: "--theme-text-inverse",
  channelBg: "--theme-channel-bg",
  channelHover: "--theme-channel-hover",
  channelActive: "--theme-channel-active",
  tooltipBg: "--theme-tooltip-bg",
  avatarFallbackBg: "--theme-avatar-fallback-bg",
  pickerBg: "--theme-picker-bg",
  pickerBorder: "--theme-picker-border",
  menuHover: "--theme-menu-hover",
  menuAccentText: "--theme-menu-accent-text",
  navActionBg: "--theme-nav-action-bg",
  navActionHover: "--theme-nav-action-hover",
  addFriendIcon: "--theme-add-friend-icon",
  addFriendHover: "--theme-add-friend-hover",
  textMutedAlt: "--theme-text-muted-alt",
  tabActiveBg: "--theme-tab-active-bg",
  tabButtonBg: "--theme-tab-button-bg",
  tabButtonHover: "--theme-tab-button-hover",
  communityTabsFallbackBg: "--theme-community-tabs-fallback-bg",
  communityTabsFallbackActiveBg: "--theme-community-tabs-fallback-active-bg",
  toolbarBg: "--theme-toolbar-bg",
  toolbarIcon: "--theme-toolbar-icon",
  toolbarBorder: "--theme-toolbar-border",
  dropdownBg: "--theme-dropdown-bg",
  dropdownBorder: "--theme-dropdown-border",
  dropdownHover: "--theme-dropdown-hover",
  reactionActiveBg: "--theme-reaction-active-bg",
  reactionActiveBorder: "--theme-reaction-active-border",
  reactionActiveText: "--theme-reaction-active-text",
  reactionBg: "--theme-reaction-bg",
  reactionBorder: "--theme-reaction-border",
  reactionText: "--theme-reaction-text",
  slotDiscoveryIcon: "--theme-slot-discovery-icon",
  slotDiscoveryBg: "--theme-slot-discovery-bg",
  slotInvitationIcon: "--theme-slot-invitation-icon",
  slotInvitationBg: "--theme-slot-invitation-bg",
  slotBorder: "--theme-slot-border",
  bgModal: "--theme-bg-modal",
  bgInputModal: "--theme-bg-input-modal",
  bgCancelButton: "--theme-bg-cancel-button",
  bgCancelButtonHover: "--theme-bg-cancel-button-hover",
  buttonSendHover: "--theme-button-send-hover",
  chatInputIcon: "--theme-chat-input-icon",
  chatInputIconHover: "--theme-chat-input-icon-hover",
  chatInputButtonBg: "--theme-chat-input-button-bg",
  chatInputSurfaceBg: "--theme-chat-input-surface-bg",
  channelTypeActiveBorder: "--theme-channel-type-active-border",
  channelTypeActiveSoftBg: "--theme-channel-type-active-soft-bg",
  channelTypeActiveBg: "--theme-channel-type-active-bg",
  channelTypeActiveText: "--theme-channel-type-active-text",
  channelTypeInactiveBg: "--theme-channel-type-inactive-bg",
  channelTypeInactiveBorder: "--theme-channel-type-inactive-border",
  channelTypeInactiveHoverBorder: "--theme-channel-type-inactive-hover-border",
  channelTypeInactiveText: "--theme-channel-type-inactive-text",
  scrollbarNavThumb: "--theme-scrollbar-nav-thumb",
  scrollbarNavThumbHover: "--theme-scrollbar-nav-thumb-hover",
  scrollbarMainThumb: "--theme-scrollbar-main-thumb",
  scrollbarMainThumbHover: "--theme-scrollbar-main-thumb-hover",
  appSettingsHover: "--theme-app-settings-hover",
  accentCustomUserButton: "--theme-accent-custom-user-button",
  bgTabHover: "--theme-bg-tab-hover",
  borderAccentItemReplyPreview: "--theme-border-accent-item-reply-preview",
  borderAccentActiveChannel: "--theme-border-accent-active-channel",
  bgEditForm: "--theme-bg-edit-form",
  notificationBg: "--theme-notification-bg",
  unreadBg: "--theme-unread-bg",
} as const;
