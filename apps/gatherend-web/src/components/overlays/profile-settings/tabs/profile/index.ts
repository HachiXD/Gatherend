// Re-export all profile sub-components
export { AvatarSection } from "./avatar-section";
export { ProfileCardEditorShell } from "./profile-card-editor-shell";
export type {
 ProfileCardEditorDraft,
 ProfileCardImageSlot,
} from "./profile-card-editor-shell";
export { UsernameSection } from "./username-section";
export { UsernameColorSection } from "./username-color-section";
export {
 BadgeSection,
 ProfileTagsSection,
 LanguagesSection,
 AccountInfoSection,
} from "./details-sections";

// Export types
export type {
 UsernameColor,
 ExtendedProfile,
 ProfileSectionProps,
 WithTranslations,
 AvatarSectionProps,
 UsernameSectionProps,
 UsernameColorSectionProps,
 BadgeSectionProps,
 ProfileTagsSectionProps,
 LanguagesSectionProps,
 AccountInfoSectionProps,
} from "./types";

// Export hooks
export * from "./hooks";
