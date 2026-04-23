"use client";

import axios from "axios";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useParams } from "next/navigation";
import { useState, useRef, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Languages } from "@prisma/client";
import type { ClientProfile } from "@/hooks/use-current-profile";
import { useUpload } from "@/hooks/use-upload";
import { useQueryClient } from "@tanstack/react-query";
import { useInvalidateProfileCard } from "@/hooks/use-profile-card";
import { applyProfilePatchToAllCaches } from "@/hooks/profile-patch-utils";
import { useTranslation, localeToLanguage, languageToLocale } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
 EDITOR_DEFAULT_CHAT_BUBBLE_STYLE,
 normalizeChatBubbleStyle,
 type ChatBubbleStyle,
} from "@/lib/chat-bubble-style";
import type { ProfileCardConfig } from "@/lib/profile-card-config";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";
import { cn } from "@/lib/utils";
import { getBubbleBorderColor } from "@/components/chat/chat-bubble-style-render";

// Import optimized hooks
import {
 useUsernameValidation,
 useUsernameColorReducer,
 useUsernameFormatReducer,
 useProfileTags,
} from "./profile/hooks";

// Import sub-components
import {
 AvatarSection,
 ProfileCardEditorShell,
 type ProfileCardEditorDraft,
 type ProfileCardImageSlot,
 UsernameSection,
 UsernameColorSection,
 BadgeSection,
 ProfileTagsSection,
 LanguagesSection,
 AccountInfoSection,
 type ExtendedProfile,
} from "./profile/index";

// Schema (simplified - only basic fields)

const schema = z.object({
 username: z
 .string()
 .min(2, { message: "Username must be at least 2 characters" })
 .max(20, { message: "Username must be at most 20 characters" }),
 avatarAssetId: z.string().optional().nullable(),
 bannerAssetId: z.string().optional().nullable(),
 badge: z
 .string()
 .max(30, { message: "Badge must be at most 30 characters" })
 .optional()
 .nullable(),
 badgeStickerId: z.string().optional().nullable(),
});

type FormSchema = z.infer<typeof schema>;

const DEFAULT_PROFILE_CARD_STYLE = {
 backgroundColor: "#707070",
 boxColor: "#8a8a8a",
 rounded: false,
 shadows: true,
} as const;
const CHAT_BUBBLE_PREVIEW_TEXT =
 "Hola esto es Gatherend :D, espero que la pases bien, trata bien a la gente y vive la vida";
const editorFieldClass =
 "h-8 rounded-lg border-theme-border-subtle bg-theme-bg-edit-form/50 text-theme-text-light placeholder:text-theme-text-muted focus-visible:border-theme-border-subtle";
const controlButtonActiveClass =
 "border-theme-channel-type-active-border bg-theme-channel-type-active-bg text-theme-channel-type-active-text hover:bg-theme-channel-type-active-bg";
const controlButtonInactiveClass =
 "border-theme-channel-type-inactive-border bg-theme-channel-type-inactive-bg text-theme-channel-type-inactive-text hover:border-theme-channel-type-inactive-hover-border";
const segmentedButtonBaseClass =
 "flex h-8 w-full cursor-pointer items-center justify-center rounded-lg border px-3 text-[13px] transition";

function clampHexColor(value: string, fallback: string | null): string | null {
 const trimmed = value.trim();
 if (/^#(?:[A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(trimmed)) {
 return trimmed;
 }

 return fallback;
}

function buildChatBubblePreviewStyle(
 style: ChatBubbleStyle,
): React.CSSProperties {
 const bg =
 style.background ??
 "color-mix(in srgb, var(--color-theme-bg-overlay-primary) 72%, transparent)";
 return {
 backgroundColor: bg,
 borderStyle: "solid",
 borderWidth: `${style.borderWidth}px`,
 borderColor: style.background
 ? getBubbleBorderColor(style.background)
 : "rgba(0,0,0,0.3)",
 borderRadius: style.roundedEnabled ? "16px" : "0px",
 boxShadow: style.shadowEnabled
 ? "inset 0 1px 0 rgba(255,255,255,0.16), inset -1px -1px 0 rgba(0,0,0,0.38)"
 : "none",
 };
}

function ChatBubbleStyleEditor({
 value,
 isSaving,
 onChange,
}: {
 value: ChatBubbleStyle;
 isSaving: boolean;
 onChange: (next: ChatBubbleStyle) => void;
}) {
 const previewStyle = useMemo(
 () => buildChatBubblePreviewStyle(value),
 [value],
 );

 return (
 <div className="rounded-lg border border-theme-border bg-theme-bg-overlay-primary/78 px-3 py-3">
 <div className="space-y-1.5">
 <div className="space-y-1">
 <div className="uppercase text-xs font-bold text-theme-text-subtle underline underline-offset-2">
 Estilo de burbuja del chat
 </div>
 <p className="text-xs text-theme-text-muted">
 Ajusta el color, el borde, la sombra y la forma de tu burbuja del
 chat.
 </p>
 </div>

 <div className="grid grid-cols-1 gap-3 mt-2 md:grid-cols-[minmax(0,1fr)_288px]">
 <div className="space-y-1.5">
 <label
 htmlFor="chat-bubble-bg-hex"
 className="block text-[11px] leading-none font-semibold uppercase tracking-[0.06em] text-theme-text-subtle"
 >
 Fondo
 </label>
 <div className="flex items-center gap-2">
 <div
 className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-theme-border-subtle"
 style={value.background !== null ? { backgroundColor: value.background } : undefined}
 >
 {value.background === null && (
 <div className="absolute inset-0 flex items-center justify-center text-theme-text-muted">
 <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
 <line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
 <line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
 </svg>
 </div>
 )}
 <input
 id="chat-bubble-bg-picker"
 name="chat-bubble-bg-picker"
 type="color"
 disabled={isSaving}
 value={value.background ?? "#374151"}
 className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
 onChange={(e) =>
 onChange({
 ...value,
 background: e.target.value,
 })
 }
 />
 </div>
 <Input
 id="chat-bubble-bg-hex"
 name="chat-bubble-bg-hex"
 disabled={isSaving}
 className={editorFieldClass}
 placeholder="Sin color"
 value={value.background ?? ""}
 onChange={(e) =>
 onChange({
 ...value,
 background: e.target.value || null,
 })
 }
 onBlur={(e) => {
 const clamped = e.target.value
 ? clampHexColor(e.target.value, null)
 : null;
 onChange({ ...value, background: clamped });
 }}
 />
 </div>
 <button
 type="button"
 disabled={isSaving || value.background === null}
 onClick={() => onChange({ ...value, background: null })}
 className="self-start text-xs text-theme-text-muted hover:text-theme-text-secondary underline cursor-pointer disabled:cursor-default disabled:opacity-40"
 >
 Sin color
 </button>
 </div>

 <div className="relative space-y-1.5">
 <label
 htmlFor="chat-bubble-border-width"
 className="block text-[11px] leading-none font-semibold uppercase tracking-[0.06em] text-theme-text-subtle"
 >
 Grosor del borde
 </label>
 <span className="absolute top-0 right-0 -translate-y-2.5 rounded-lg border border-theme-border-subtle bg-theme-bg-edit-form/50 px-2 py-0.5 text-[11px] font-mono text-theme-text-muted">
 {value.borderWidth}px
 </span>
 <div className="flex h-8 items-center rounded-lg border border-theme-border-subtle bg-theme-bg-edit-form/35 px-3">
 <input
 id="chat-bubble-border-width"
 name="chat-bubble-border-width"
 type="range"
 min="0"
 max="5"
 step="1"
 disabled={isSaving}
 value={value.borderWidth}
 onChange={(e) =>
 onChange({
 ...value,
 borderWidth: Math.max(
 0,
 Math.min(5, Number.parseInt(e.target.value, 10)),
 ),
 })
 }
 className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-theme-bg-edit-form accent-theme-accent-primary disabled:cursor-not-allowed"
 aria-label="Grosor del borde"
 />
 </div>
 </div>
 </div>

 <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
 <div className="space-y-0.5">
 <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-theme-text-subtle">
 Esquinas
 </div>
 <div className="grid grid-cols-2">
 <button
 type="button"
 disabled={isSaving}
 onClick={() =>
 onChange({
 ...value,
 roundedEnabled: true,
 })
 }
 className={cn(
 segmentedButtonBaseClass,
 "border-r-0",
 value.roundedEnabled
 ? controlButtonActiveClass
 : controlButtonInactiveClass,
 )}
 >
 Redondeadas
 </button>
 <button
 type="button"
 disabled={isSaving}
 onClick={() =>
 onChange({
 ...value,
 roundedEnabled: false,
 })
 }
 className={cn(
 segmentedButtonBaseClass,
 !value.roundedEnabled
 ? controlButtonActiveClass
 : controlButtonInactiveClass,
 )}
 >
 Cuadradas
 </button>
 </div>
 </div>

 <div className="space-y-0.5">
 <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-theme-text-subtle">
 Sombra
 </div>
 <div className="grid grid-cols-2">
 <button
 type="button"
 disabled={isSaving}
 onClick={() =>
 onChange({
 ...value,
 shadowEnabled: true,
 })
 }
 className={cn(
 segmentedButtonBaseClass,
 "border-r-0",
 value.shadowEnabled
 ? controlButtonActiveClass
 : controlButtonInactiveClass,
 )}
 >
 Con sombra
 </button>
 <button
 type="button"
 disabled={isSaving}
 onClick={() =>
 onChange({
 ...value,
 shadowEnabled: false,
 })
 }
 className={cn(
 segmentedButtonBaseClass,
 !value.shadowEnabled
 ? controlButtonActiveClass
 : controlButtonInactiveClass,
 )}
 >
 Sin sombra
 </button>
 </div>
 </div>
 </div>

 <div className="space-y-1">
 <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-theme-text-subtle">
 Vista previa
 </div>
 <div className="rounded-lg border border-theme-border-subtle bg-theme-bg-edit-form/35 p-3">
 <div className="flex justify-start">
 <div
 className="max-w-[320px] text-sm leading-6 text-white/92"
 style={previewStyle}
 >
 <div className="px-3 py-2.5">{CHAT_BUBBLE_PREVIEW_TEXT}</div>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}

function trimToNull(value: string) {
 const trimmed = value.trim();
 return trimmed.length > 0 ? trimmed : null;
}

function createUploadedAssetFromUpload(file: {
 assetId: string;
 url: string;
 width?: number;
 height?: number;
}): ClientUploadedAsset {
 return {
 id: file.assetId,
 url: file.url,
 width: file.width ?? null,
 height: file.height ?? null,
 dominantColor: null,
 };
}

function createInitialProfileCardDraft(
 profile: ExtendedProfile,
): ProfileCardEditorDraft {
 const config = profile.profileCardConfig;

 return {
 style: {
 backgroundColor:
 config?.style.backgroundColor ??
 DEFAULT_PROFILE_CARD_STYLE.backgroundColor,
 boxColor: config?.style.boxColor ?? DEFAULT_PROFILE_CARD_STYLE.boxColor,
 rounded: config?.style.rounded ?? DEFAULT_PROFILE_CARD_STYLE.rounded,
 shadows: config?.style.shadows ?? DEFAULT_PROFILE_CARD_STYLE.shadows,
 },
 content: {
 pageTitle: config?.content.pageTitle ?? "",
 leftTopTextTitle: config?.content.leftTopText?.title ?? "",
 leftTopTextContent: config?.content.leftTopText?.content ?? "",
 sectionATitle: config?.content.leftBottomText?.sectionA?.title ?? "",
 sectionAContent: config?.content.leftBottomText?.sectionA?.content ?? "",
 sectionBTitle: config?.content.leftBottomText?.sectionB?.title ?? "",
 sectionBContent: config?.content.leftBottomText?.sectionB?.content ?? "",
 rightTopImageTitle: config?.content.rightTopImage?.title ?? "",
 rightBottomImageTitle: config?.content.rightBottomImage?.title ?? "",
 },
 images: {
 leftTopImage: {
 assetId: profile.profileCardLeftTopImageAssetId,
 asset: profile.profileCardLeftTopImageAsset,
 },
 leftBottomRightTopImage: {
 assetId: profile.profileCardLeftBottomRightTopImageAssetId,
 asset: profile.profileCardLeftBottomRightTopImageAsset,
 },
 leftBottomRightBottomImage: {
 assetId: profile.profileCardLeftBottomRightBottomImageAssetId,
 asset: profile.profileCardLeftBottomRightBottomImageAsset,
 },
 rightTopImage: {
 assetId: profile.profileCardRightTopImageAssetId,
 asset: profile.profileCardRightTopImageAsset,
 },
 rightBottomImage: {
 assetId: profile.profileCardRightBottomImageAssetId,
 asset: profile.profileCardRightBottomImageAsset,
 },
 },
 };
}

function buildProfileCardConfigFromDraft(draft: ProfileCardEditorDraft): {
 config: ProfileCardConfig;
 error: string | null;
} {
 const pageTitle = trimToNull(draft.content.pageTitle);
 const leftTopTextTitle = trimToNull(draft.content.leftTopTextTitle);
 const leftTopTextContent = trimToNull(draft.content.leftTopTextContent);
 const sectionATitle = trimToNull(draft.content.sectionATitle);
 const sectionAContent = trimToNull(draft.content.sectionAContent);
 const sectionBTitle = trimToNull(draft.content.sectionBTitle);
 const sectionBContent = trimToNull(draft.content.sectionBContent);
 const rightTopImageTitle = trimToNull(draft.content.rightTopImageTitle);
 const rightBottomImageTitle = trimToNull(draft.content.rightBottomImageTitle);

 if (leftTopTextTitle && !leftTopTextContent) {
 return {
 config: {
 version: 1,
 style: { ...draft.style },
 content: {},
 },
 error: "leftTopText needs content before you save a title.",
 };
 }

 const hasPartialSectionA =
 Boolean(sectionATitle) !== Boolean(sectionAContent);
 if (hasPartialSectionA) {
 return {
 config: {
 version: 1,
 style: { ...draft.style },
 content: {},
 },
 error: "Section A needs both title and content.",
 };
 }

 const hasPartialSectionB =
 Boolean(sectionBTitle) !== Boolean(sectionBContent);
 if (hasPartialSectionB) {
 return {
 config: {
 version: 1,
 style: { ...draft.style },
 content: {},
 },
 error: "Section B needs both title and content.",
 };
 }

 if (rightTopImageTitle && !draft.images.rightTopImage.assetId) {
 return {
 config: {
 version: 1,
 style: { ...draft.style },
 content: {},
 },
 error: "rightTopImage needs an uploaded image before adding a title.",
 };
 }

 if (rightBottomImageTitle && !draft.images.rightBottomImage.assetId) {
 return {
 config: {
 version: 1,
 style: { ...draft.style },
 content: {},
 },
 error: "rightBottomImage needs an uploaded image before adding a title.",
 };
 }

 return {
 config: {
 version: 1,
 style: {
 backgroundColor: draft.style.backgroundColor,
 boxColor: draft.style.boxColor,
 rounded: draft.style.rounded,
 shadows: draft.style.shadows,
 },
 content: {
 ...(pageTitle ? { pageTitle } : {}),
 ...(leftTopTextContent
 ? {
 leftTopText: {
 content: leftTopTextContent,
 ...(leftTopTextTitle ? { title: leftTopTextTitle } : {}),
 },
 }
 : {}),
 ...((sectionATitle && sectionAContent) ||
 (sectionBTitle && sectionBContent)
 ? {
 leftBottomText: {
 ...(sectionATitle && sectionAContent
 ? {
 sectionA: {
 title: sectionATitle,
 content: sectionAContent,
 },
 }
 : {}),
 ...(sectionBTitle && sectionBContent
 ? {
 sectionB: {
 title: sectionBTitle,
 content: sectionBContent,
 },
 }
 : {}),
 },
 }
 : {}),
 ...(rightTopImageTitle
 ? { rightTopImage: { title: rightTopImageTitle } }
 : {}),
 ...(rightBottomImageTitle
 ? { rightBottomImage: { title: rightBottomImageTitle } }
 : {}),
 },
 },
 error: null,
 };
}

// Props

interface ProfileTabProps {
 user: ClientProfile;
}

// Component

export const ProfileTab = ({ user }: ProfileTabProps) => {
 const extendedUser = user as ExtendedProfile;
 const params = useParams();
 const queryClient = useQueryClient();
 const { invalidateProfileCard } = useInvalidateProfileCard();
 const { locale, setLocale, t } = useTranslation();
 const panelShellClass =
 "rounded-lg border border-theme-border bg-theme-bg-overlay-primary/78 px-4 py-4 sm:px-5 sm:py-5";
 const sectionTitleClass =
 "border-b border-theme-border -mt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-theme-text-muted";

 // Form State (react-hook-form for simple fields only)

 const form = useForm<FormSchema>({
 resolver: zodResolver(schema),
 defaultValues: {
 username: user.username,
 avatarAssetId: user.avatarAssetId || "",
 bannerAssetId: user.bannerAssetId || "",
 badge: extendedUser.badge || "",
 badgeStickerId: extendedUser.badgeStickerId || "",
 },
 });

 const [isSaving, setIsSaving] = useState(false);
 const [profileCardDraft, setProfileCardDraft] =
 useState<ProfileCardEditorDraft>(() =>
 createInitialProfileCardDraft(extendedUser),
 );
 const [chatBubbleStyle, setChatBubbleStyle] = useState<ChatBubbleStyle>(() =>
 normalizeChatBubbleStyle(extendedUser.chatBubbleStyle) ?? { ...EDITOR_DEFAULT_CHAT_BUBBLE_STYLE },
 );
 const [activeProfileCardUploadSlot, setActiveProfileCardUploadSlot] =
 useState<ProfileCardImageSlot | null>(null);

 // Username Validation (dedicated hook with debounce)

 const originalUsername = useRef(user.username).current;

 const usernameValidation = useUsernameValidation({
 originalUsername,
 translations: useMemo(
 () => ({
 checking: t.auth.checking,
 usernameTooShort: t.auth.usernameTooShort,
 youllBe: t.auth.youllBe,
 usernameNotAvailable: t.auth.usernameNotAvailable,
 errorCheckingUsername: t.auth.errorCheckingUsername,
 }),
 [t.auth],
 ),
 });

 const handleUsernameChange = useCallback(
 (value: string) => {
 form.setValue("username", value);
 usernameValidation.validate(value);
 },
 [form, usernameValidation],
 );

 // Username Color (reducer - consolidated state)

 const usernameColor = useUsernameColorReducer(extendedUser.usernameColor);

 // Username Format (reducer - consolidated state)

 const usernameFormat = useUsernameFormatReducer(extendedUser.usernameFormat);

 // Profile Tags (dedicated hook with validation)

 const profileTags = useProfileTags({
 initialTags: extendedUser.profileTags || [],
 });

 // Languages State

 const [mainLanguage, setMainLanguage] = useState<Languages>(
 localeToLanguage(locale) as Languages,
 );
 const [secondaryLanguages, setSecondaryLanguages] = useState<Languages[]>(
 () => {
 const main = localeToLanguage(locale) as Languages;
 return (user.languages || []).filter((l) => l !== main);
 },
 );

 const selectedLanguages = useMemo(
 () => [
 mainLanguage,
 ...secondaryLanguages.filter((l) => l !== mainLanguage),
 ],
 [mainLanguage, secondaryLanguages],
 );

 const handleMainLanguageChange = useCallback(
 (language: Languages) => {
 const newLocale = languageToLocale(language);
 setMainLanguage(language);
 setLocale(newLocale);
 setSecondaryLanguages((prev) => prev.filter((l) => l !== language));
 },
 [setLocale],
 );

 const addSecondaryLanguage = useCallback(
 (language: Languages) => {
 if (language === mainLanguage) {
 toast.error(t.profile.selectAtLeastOneLanguage);
 return;
 }
 setSecondaryLanguages((prev) =>
 prev.includes(language) ? prev : [...prev, language],
 );
 },
 [mainLanguage, t.profile.selectAtLeastOneLanguage],
 );

 const removeSecondaryLanguage = useCallback((language: Languages) => {
 setSecondaryLanguages((prev) => prev.filter((l) => l !== language));
 }, []);

 // Avatar Upload

 const [imagePreview, setImagePreview] = useState<string>(
 user.avatarAsset?.url || "",
 );
 const [bannerPreview, setBannerPreview] = useState<string | null>(
 user.bannerAsset?.url || null,
 );
 const [uploading, setUploading] = useState(false);
 const [uploadingBanner, setUploadingBanner] = useState(false);
 const fileInputRef = useRef<HTMLInputElement>(null);
 const profileCardFileInputRef = useRef<HTMLInputElement>(null);
 const bannerFileInputRef = useRef<HTMLInputElement>(null);

 const { startUpload } = useUpload("profile_avatar", {
 onModerationBlock: (reason) => toast.error(reason),
 onUploadError: (error) => toast.error(`Upload failed: ${error}`),
 });
 const { startUpload: startBannerUpload } = useUpload("profile_banner", {
 onModerationBlock: (reason) => toast.error(reason),
 onUploadError: (error) => toast.error(`Upload failed: ${error}`),
 });
 const {
 startUpload: startProfileCardUpload,
 isUploading: isProfileCardUploading,
 } = useUpload("profile_card_image", {
 onModerationBlock: (reason) => toast.error(reason),
 onUploadError: (error) => toast.error(`Upload failed: ${error}`),
 });

 const handleImageUpload = useCallback(
 async (e: React.ChangeEvent<HTMLInputElement>) => {
 const files = e.target.files;
 if (!files || files.length === 0) return;

 setUploading(true);
 try {
 const res = await startUpload(Array.from(files));
 const file = res?.[0];
 if (file) {
 setImagePreview(file.url);
 form.setValue("avatarAssetId", file.assetId);
 }
 } catch {
 toast.error("Failed to upload image");
 } finally {
 setUploading(false);
 if (fileInputRef.current) fileInputRef.current.value = "";
 }
 },
 [startUpload, form],
 );

 const handleUploadClick = useCallback(() => {
 fileInputRef.current?.click();
 }, []);

 const handleBannerUpload = useCallback(
 async (e: React.ChangeEvent<HTMLInputElement>) => {
 const files = e.target.files;
 if (!files || files.length === 0) return;

 setUploadingBanner(true);
 try {
 const res = await startBannerUpload(Array.from(files));
 const file = res?.[0];
 if (file) {
 setBannerPreview(file.url);
 form.setValue("bannerAssetId", file.assetId);
 }
 } catch {
 toast.error("Failed to upload banner image");
 } finally {
 setUploadingBanner(false);
 if (bannerFileInputRef.current) bannerFileInputRef.current.value = "";
 }
 },
 [form, startBannerUpload],
 );

 const handleBannerUploadClick = useCallback(() => {
 bannerFileInputRef.current?.click();
 }, []);

 const handleClearBanner = useCallback(() => {
 setBannerPreview(null);
 form.setValue("bannerAssetId", null);
 if (bannerFileInputRef.current) bannerFileInputRef.current.value = "";
 }, [form]);

 const handleProfileCardStyleChange = useCallback(
 (field: keyof ProfileCardEditorDraft["style"], value: string | boolean) => {
 setProfileCardDraft((current) => ({
 ...current,
 style: {
 ...current.style,
 [field]: value,
 },
 }));
 },
 [],
 );

 const handleProfileCardContentChange = useCallback(
 (field: keyof ProfileCardEditorDraft["content"], value: string) => {
 setProfileCardDraft((current) => ({
 ...current,
 content: {
 ...current.content,
 [field]: value,
 },
 }));
 },
 [],
 );

 const handleProfileCardUploadClick = useCallback(
 (slot: ProfileCardImageSlot) => {
 setActiveProfileCardUploadSlot(slot);
 profileCardFileInputRef.current?.click();
 },
 [],
 );

 const handleProfileCardClearImage = useCallback(
 (slot: ProfileCardImageSlot) => {
 setProfileCardDraft((current) => ({
 ...current,
 content: {
 ...current.content,
 ...(slot === "rightTopImage" ? { rightTopImageTitle: "" } : {}),
 ...(slot === "rightBottomImage" ? { rightBottomImageTitle: "" } : {}),
 },
 images: {
 ...current.images,
 [slot]: {
 assetId: null,
 asset: null,
 },
 },
 }));
 },
 [],
 );

 const handleProfileCardImageUpload = useCallback(
 async (e: React.ChangeEvent<HTMLInputElement>) => {
 const files = e.target.files;
 const activeSlot = activeProfileCardUploadSlot;
 if (!files || files.length === 0 || !activeSlot) {
 setActiveProfileCardUploadSlot(null);
 if (profileCardFileInputRef.current) {
 profileCardFileInputRef.current.value = "";
 }
 return;
 }

 try {
 const res = await startProfileCardUpload(Array.from(files));
 const file = res?.[0];
 if (file) {
 setProfileCardDraft((current) => ({
 ...current,
 images: {
 ...current.images,
 [activeSlot]: {
 assetId: file.assetId,
 asset: createUploadedAssetFromUpload(file),
 },
 },
 }));
 }
 } catch {
 toast.error("Failed to upload profile card image");
 } finally {
 setActiveProfileCardUploadSlot(null);
 if (profileCardFileInputRef.current) {
 profileCardFileInputRef.current.value = "";
 }
 }
 },
 [activeProfileCardUploadSlot, startProfileCardUpload],
 );

 // Form Submission

 const onSubmit = useCallback(
 async (values: FormSchema) => {
 const { config: profileCardConfig, error: profileCardConfigError } =
 buildProfileCardConfigFromDraft(profileCardDraft);

 if (profileCardConfigError) {
 toast.error(profileCardConfigError);
 return;
 }

 try {
 setIsSaving(true);

 const updatedProfileData = {
 username: values.username,
 avatarAssetId: values.avatarAssetId,
 bannerAssetId: values.bannerAssetId,
 languages: selectedLanguages,
 chatBubbleStyle,
 usernameColor: usernameColor.buildColor(),
 profileTags: profileTags.state.tags,
 badge: values.badge || null,
 badgeStickerId: values.badgeStickerId || null,
 usernameFormat: usernameFormat.buildFormat(),
 profileCardConfig,
 profileCardLeftTopImageAssetId:
 profileCardDraft.images.leftTopImage.assetId,
 profileCardLeftBottomRightTopImageAssetId:
 profileCardDraft.images.leftBottomRightTopImage.assetId,
 profileCardLeftBottomRightBottomImageAssetId:
 profileCardDraft.images.leftBottomRightBottomImage.assetId,
 profileCardRightTopImageAssetId:
 profileCardDraft.images.rightTopImage.assetId,
 profileCardRightBottomImageAssetId:
 profileCardDraft.images.rightBottomImage.assetId,
 };

 const response = await axios.patch("/api/profile", updatedProfileData);
 const serverProfile = response.data;
 setProfileCardDraft(createInitialProfileCardDraft(serverProfile));
 setChatBubbleStyle(
 normalizeChatBubbleStyle(serverProfile.chatBubbleStyle) ?? { ...EDITOR_DEFAULT_CHAT_BUBBLE_STYLE },
 );

 // Update React Query cache (simplified - let invalidation handle the rest)
 queryClient.setQueryData(
 ["current-profile"],
 (oldProfile: ClientProfile | undefined) =>
 oldProfile ? { ...oldProfile, ...serverProfile } : serverProfile,
 );

 // Patch all relevant client caches, including the live chat window store.
 applyProfilePatchToAllCaches(queryClient, user.id, {
 username: serverProfile.username,
 discriminator: serverProfile.discriminator,
 avatarAsset: serverProfile.avatarAsset,
 bannerAsset: serverProfile.bannerAsset,
 chatBubbleStyle: serverProfile.chatBubbleStyle,
 usernameColor: serverProfile.usernameColor,
 usernameFormat: serverProfile.usernameFormat,
 profileTags: serverProfile.profileTags,
 badge: serverProfile.badge,
 badgeSticker: serverProfile.badgeSticker,
 });

 // Invalidate related caches
 invalidateProfileCard(user.id);

 await Promise.all([
 params?.boardId
 ? queryClient.invalidateQueries({
 queryKey: ["board", params.boardId],
 })
 : Promise.resolve(),
 queryClient.invalidateQueries({ queryKey: ["user-boards"] }),
 queryClient.invalidateQueries({ queryKey: ["conversations"] }),
 ]);

 toast.success(t.profile.updateSuccess);
 } catch {
 toast.error(t.profile.updateError);
 } finally {
 setIsSaving(false);
 }
 },
 [
 selectedLanguages,
 chatBubbleStyle,
 usernameColor,
 profileTags.state.tags,
 usernameFormat,
 profileCardDraft,
 queryClient,
 invalidateProfileCard,
 user.id,
 params?.boardId,
 t.profile.updateSuccess,
 t.profile.updateError,
 ],
 );

 // Memoized form values (avoid watch() re-renders)

 // Use getValues with a controlled re-render trigger via form state
 const { username, badge, badgeStickerId } = form.watch();

 // Render

 const isSubmitDisabled =
 isSaving ||
 uploading ||
 uploadingBanner ||
 isProfileCardUploading ||
 !usernameValidation.status.valid ||
 usernameValidation.status.checking;

 return (
 <div className="mx-auto max-w-2xl space-y-2 pb-10">
 {/* Header */}
 <div className={panelShellClass}>
 <div className="border-b border-theme-border pb-0.5 -mb-3 -mt-3">
 <h2 className="text-2xl font-bold text-theme-text-primary">
 {t.profile.title}
 </h2>
 <p className="-mt-1 text-sm text-theme-text-tertiary">
 {t.profile.subtitle}
 </p>
 </div>
 </div>

 <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
 {/* Hidden file input */}
 <label htmlFor="profile-avatar-upload" className="sr-only">
 Upload profile avatar
 </label>
 <input
 id="profile-avatar-upload"
 name="profile-avatar-upload"
 ref={fileInputRef}
 type="file"
 accept="image/*"
 className="hidden"
 onChange={handleImageUpload}
 />
 <label htmlFor="profile-banner-upload" className="sr-only">
 Upload profile banner
 </label>
 <input
 id="profile-banner-upload"
 name="profile-banner-upload"
 ref={bannerFileInputRef}
 type="file"
 accept="image/*"
 className="hidden"
 onChange={handleBannerUpload}
 />
 <label htmlFor="profile-card-image-upload" className="sr-only">
 Upload profile card image
 </label>
 <input
 id="profile-card-image-upload"
 name="profile-card-image-upload"
 ref={profileCardFileInputRef}
 type="file"
 accept="image/*"
 className="hidden"
 onChange={handleProfileCardImageUpload}
 />

 {/* SECTION 1: PROFILE PAGE LAYOUT */}
 <section className={panelShellClass}>
 <h3 className={sectionTitleClass}>Detalles del Perfil</h3>
 <div className="mt-3 -mb-2">
 <ProfileCardEditorShell
 bannerUrl={bannerPreview}
 draft={profileCardDraft}
 isSaving={isSaving}
 isUploadingImage={isProfileCardUploading}
 isUploadingBanner={uploadingBanner}
 activeUploadSlot={activeProfileCardUploadSlot}
 avatarEditor={
 <AvatarSection
 profileId={user.id}
 imagePreview={imagePreview}
 usernameColor={extendedUser.usernameColor}
 uploading={uploading}
 isSaving={isSaving}
 onUploadClick={handleUploadClick}
 t={t}
 />
 }
 identityEditor={
 <div className="w-full space-y-2">
 <UsernameSection
 username={username}
 usernameColor={usernameColor.buildColor()}
 discriminator={user.discriminator}
 usernameStatus={usernameValidation.status}
 originalUsername={originalUsername}
 formatState={usernameFormat.state}
 formatActions={usernameFormat.actions}
 isSaving={isSaving}
 onUsernameChange={handleUsernameChange}
 t={t}
 />

 <UsernameColorSection
 colorState={usernameColor.state}
 colorActions={usernameColor.actions}
 isSaving={isSaving}
 t={t}
 />
 </div>
 }
 onStyleChange={handleProfileCardStyleChange}
 onContentChange={handleProfileCardContentChange}
 onBannerUploadClick={handleBannerUploadClick}
 onClearBanner={handleClearBanner}
 onUploadClick={handleProfileCardUploadClick}
 onClearImage={handleProfileCardClearImage}
 />
 </div>
 </section>

 {/* SECTION 2: DETAILS */}
 <section className={panelShellClass}>
 <h3 className={sectionTitleClass}>Estilos y Datos adicionales</h3>
 <div className="mt-2.5 space-y-1.5">
 <ChatBubbleStyleEditor
 value={chatBubbleStyle}
 isSaving={isSaving}
 onChange={setChatBubbleStyle}
 />

 <BadgeSection
 badgeText={badge}
 badgeStickerId={badgeStickerId}
 profileId={user.id}
 isSaving={isSaving}
 onBadgeTextChange={(value) => form.setValue("badge", value)}
 onBadgeStickerIdChange={(stickerId) =>
 form.setValue("badgeStickerId", stickerId)
 }
 t={t}
 />

 <ProfileTagsSection
 tagsState={profileTags.state}
 tagsActions={profileTags.actions}
 isSaving={isSaving}
 />

 <LanguagesSection
 mainLanguage={mainLanguage}
 secondaryLanguages={secondaryLanguages}
 isSaving={isSaving}
 onMainLanguageChange={handleMainLanguageChange}
 onAddSecondaryLanguage={addSecondaryLanguage}
 onRemoveSecondaryLanguage={removeSecondaryLanguage}
 t={t}
 />
 </div>
 </section>

 {/* SECTION 3: ACCOUNT INFO (Read Only) */}
 <section className={panelShellClass}>
 <h3 className={sectionTitleClass}>{t.profile.accountInfo}</h3>
 <div className="mt-4">
 <AccountInfoSection email={user.email} visibleId={user.id} t={t} />
 </div>
 </section>

 {/* Footer Actions */}
 <section className={panelShellClass}>
 <div className="flex justify-end">
 <Button
 type="submit"
 disabled={isSubmitDisabled}
 className="h-6.5 min-w-[120px] -my-3 cursor-pointer rounded-lg bg-theme-tab-button-bg px-3 text-[14px] text-theme-text-light hover:bg-theme-tab-button-hover"
 >
 {isSaving ? t.profile.saving : t.profile.saveChanges}
 </Button>
 </div>
 </section>
 </form>
 </div>
 );
};
