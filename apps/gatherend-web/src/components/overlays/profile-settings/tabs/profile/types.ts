import { Languages } from "@prisma/client";
import type { UsernameFormatConfig } from "@/lib/username-format";
import type {
  EditableGradientColorStop,
  UsernameColor,
  UsernameColorState,
} from "./username-color-types";
import type { UsernameFormatState } from "./hooks/use-username-format-reducer";
import type { ProfileTagsState } from "./hooks/use-profile-tags";
import type { TranslationKeys } from "@/i18n/types";
import type { ClientProfile } from "@/hooks/use-current-profile";

// Types for Profile Tab Components

// Extended profile type that includes customization fields
export type ExtendedProfile = ClientProfile & {
 usernameColor?: UsernameColor;
 profileTags?: string[];
 badge?: string | null;
 usernameFormat?: UsernameFormatConfig | null;
};

// Shared Props

export interface ProfileSectionProps {
 isSaving: boolean;
}

// Translation prop (passed down to avoid useTranslation in every component)
export interface WithTranslations {
 t: TranslationKeys;
}

// Avatar Section

export interface AvatarSectionProps
 extends ProfileSectionProps, WithTranslations {
 profileId: string;
 imagePreview: string;
 usernameColor?: UsernameColor;
 uploading: boolean;
 onUploadClick: () => void;
}

// Username Section (refactored to use reducer state)

export interface UsernameSectionProps
 extends ProfileSectionProps, WithTranslations {
 username: string;
 usernameColor: UsernameColor;
 discriminator: string | null;
 usernameStatus: {
 checking: boolean;
 valid: boolean;
 message: string;
 };
 originalUsername: string;
 formatState: UsernameFormatState;
 formatActions: {
 toggleBold: () => void;
 toggleItalic: () => void;
 toggleUnderline: () => void;
 };
 onUsernameChange: (value: string) => void;
}

// Username Color Section (refactored to use reducer)

export interface UsernameColorSectionProps
 extends ProfileSectionProps, WithTranslations {
 colorState: UsernameColorState;
 colorActions: {
 setMode: (mode: "solid" | "gradient") => void;
 setSolidColor: (color: string) => void;
 setGradientColors: (colors: EditableGradientColorStop[]) => void;
 setGradientAngle: (angle: number) => void;
 setGradientAnimated: (animated: boolean) => void;
 setAnimationType: (type: "shift" | "shimmer" | "pulse") => void;
 setSelectedId: (id: string | null) => void;
 updateSelectedColor: (color: string) => void;
 removeSelectedColor: () => void;
 };
}

// Badge Section (refactored - lazy loads stickers)

export interface BadgeSectionProps
 extends ProfileSectionProps, WithTranslations {
 badgeText: string | null | undefined;
 badgeStickerId: string | null | undefined;
 profileId: string; // For lazy loading stickers
 onBadgeTextChange: (value: string) => void;
 onBadgeStickerIdChange: (stickerId: string) => void;
}

// Profile Tags Section (refactored to use hook state)

export interface ProfileTagsSectionProps extends ProfileSectionProps {
 tagsState: ProfileTagsState & {
 tags: string[];
 input: string;
 canAddMore: boolean;
 count: number;
 maxTags: number;
 };
 tagsActions: {
 setInput: (value: string) => void;
 addTag: (tag: string) => boolean;
 removeTag: (index: number) => void;
 handleInputKeyDown: (e: React.KeyboardEvent) => void;
 };
}

// Languages Section

export interface LanguagesSectionProps
 extends ProfileSectionProps, WithTranslations {
 mainLanguage: Languages;
 secondaryLanguages: Languages[];
 onMainLanguageChange: (language: Languages) => void;
 onAddSecondaryLanguage: (language: Languages) => void;
 onRemoveSecondaryLanguage: (language: Languages) => void;
}

// Account Info Section

export interface AccountInfoSectionProps extends WithTranslations {
 email: string;
 visibleId: string;
}
