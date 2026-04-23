"use client";

import { memo, useState } from "react";
import { X, Plus, Check } from "lucide-react";
import { Languages } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { AnimatedSticker } from "@/components/ui/animated-sticker";
import { useStickers } from "@/hooks/use-stickers";
import type {
 BadgeSectionProps,
 ProfileTagsSectionProps,
 LanguagesSectionProps,
 AccountInfoSectionProps,
} from "./types";

const fieldInputClass =
 "h-8 rounded-lg border-theme-border-subtle bg-theme-bg-edit-form/50 text-theme-text-light placeholder:text-theme-text-muted focus-visible:border-theme-border-subtle";
const fieldTextareaClass =
 "rounded-lg border-theme-border-subtle bg-theme-bg-edit-form/50 text-theme-text-light placeholder:text-theme-text-muted focus-visible:border-theme-border-subtle";
const readonlyFieldInputClass =
 "h-8 rounded-lg border-theme-border-subtle bg-theme-bg-edit-form/35 text-theme-text-muted";
const panelButtonBaseClass =
 "h-8 cursor-pointer rounded-lg border px-3 text-[13px] transition";
const panelButtonActiveClass =
 "border-theme-channel-type-active-border bg-theme-channel-type-active-bg hover:bg-theme-channel-type-active-bg text-theme-channel-type-active-text";
const panelButtonInactiveClass =
 "border-theme-channel-type-inactive-border bg-theme-channel-type-inactive-bg text-theme-channel-type-inactive-text hover:border-theme-channel-type-inactive-hover-border";
const panelSelectTriggerClass =
 "h-8 w-full cursor-pointer rounded-lg border border-theme-border-subtle bg-theme-bg-edit-form/50 text-theme-text-light hover:bg-theme-bg-edit-form/50 focus:border-theme-border-subtle focus:ring-0";
const panelSelectContentClass =
 "w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)] rounded-lg border-theme-border bg-theme-bg-modal p-0 text-theme-text-secondary [&>div]:p-0";
const panelSelectItemClass =
 "h-8 w-full cursor-pointer rounded-lg border-x-0 border-t-0 border-b border-theme-border-subtle px-2 hover:border-theme-channel-type-active-border hover:bg-theme-channel-type-active-bg hover:text-theme-channel-type-active-text focus:border-theme-channel-type-active-border focus:bg-theme-channel-type-active-bg focus:text-theme-channel-type-active-text";

// Badge Section (with lazy-loaded stickers)

export const BadgeSection = memo(function BadgeSection({
 badgeText,
 badgeStickerId,
 profileId,
 isSaving,
 onBadgeTextChange,
 onBadgeStickerIdChange,
 t,
}: BadgeSectionProps) {
 // Lazy load stickers only when this section is interacted with
 const [stickersEnabled, setStickersEnabled] = useState(!!badgeStickerId);

 const { data: allStickers, isLoading: stickersLoading } = useStickers(
 stickersEnabled ? profileId : undefined,
 );
 const myStickers =
 allStickers?.filter((s) => s.uploaderId === profileId) || [];

 // Enable stickers loading when user focuses on the section
 const handleEnableStickers = () => {
 if (!stickersEnabled) {
 setStickersEnabled(true);
 }
 };

 return (
 <div
 className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start"
 onFocus={handleEnableStickers}
 onMouseEnter={handleEnableStickers}
 >
 {/* Badge Text */}
 <div className="space-y-2">
 <label
 htmlFor="profile-badge-text"
 className="uppercase text-xs font-bold text-theme-text-subtle"
 >
 {t.profile.badgeText}
 </label>
 <div className="relative w-full">
 <Textarea
 id="profile-badge-text"
 name="profile-badge-text"
 disabled={isSaving}
 className={cn(fieldTextareaClass, "w-full resize-none break-all")}
 placeholder={t.profile.badgePlaceholder}
 maxLength={30}
 rows={2}
 value={badgeText || ""}
 onChange={(e) => onBadgeTextChange(e.target.value)}
 />
 <span className="absolute right-3 bottom-2 text-xs text-theme-text-muted">
 {(badgeText || "").length}/30
 </span>
 </div>
 </div>

 {/* Badge Sticker */}
 <div className="mt-1.5 space-y-0.5">
 <span
 id="badge-sticker-label"
 className="uppercase text-xs font-bold text-theme-text-subtle block"
 >
 {t.profile.badgeSticker}
 </span>
 <div
 className="relative w-full"
 role="group"
 aria-labelledby="badge-sticker-label"
 >
 {/* Sticker selection grid */}
 {stickersEnabled ? (
 myStickers.length > 0 ? (
 <div className="grid max-h-[120px] min-h-[64px] grid-cols-6 content-center gap-2 overflow-y-auto rounded-lg border border-theme-border-subtle bg-theme-bg-edit-form/50 p-2">
 {myStickers.map((sticker) => (
 <button
  key={sticker.id}
  type="button"
 onClick={() =>
 onBadgeStickerIdChange(
 badgeStickerId === sticker.id ? "" : sticker.id,
 )
 }
 className={cn(
  "relative h-10 w-10 cursor-pointer rounded-lg border p-1 transition",
 badgeStickerId === sticker.id
 ? panelButtonActiveClass
 : panelButtonInactiveClass,
 )}
 disabled={isSaving}
 aria-label={`Select ${sticker.name} sticker`}
 aria-pressed={badgeStickerId === sticker.id}
 >
 <AnimatedSticker
 src={sticker.asset?.url || ""}
 alt={sticker.name}
 containerClassName="h-full w-full"
 className="p-0.5"
 fallbackWidthPx={40}
 fallbackHeightPx={40}
 />
 {badgeStickerId === sticker.id && (
  <div className="absolute -right-1 -top-1 rounded-full bg-theme-border-accent-active-channel p-0.5">
 <Check className="h-2.5 w-2.5 text-white" />
 </div>
 )}
 </button>
 ))}
 </div>
 ) : (
 <div className="flex min-h-[64px] items-center justify-center rounded-lg border border-theme-border-subtle bg-theme-bg-edit-form/50 p-3 text-center text-sm text-theme-text-muted">
 {stickersLoading
 ? t.profile.loadingStickers
 : t.profile.noStickers}
 </div>
 )
 ) : (
 <div className="min-h-[64px] rounded-lg border border-theme-border-subtle bg-theme-bg-edit-form/50 p-3" />
 )}
 </div>
 </div>
 </div>
 );
});

// Profile Tags Section (uses hook state directly)

export const ProfileTagsSection = memo(function ProfileTagsSection({
 tagsState,
 tagsActions,
 isSaving,
}: ProfileTagsSectionProps) {
 return (
 <div className="space-y-0.5">
 <label
 htmlFor="profile-tag-input"
 className="uppercase text-xs font-bold text-theme-text-subtle "
 >
 Profile Tags
 </label>
 <p className="text-xs text-theme-text-muted mb-1.5 ">
 Add up to 10 short tags (max 10 characters each) like
 &quot;Hispano&quot;, &quot;19yo&quot;, &quot;Furry&quot;, etc.
 </p>

 {/* Tag Input */}
 <div className="flex items-center gap-2">
 <Input
 id="profile-tag-input"
 name="profile-tag-input"
 disabled={isSaving || !tagsState.canAddMore}
 className={fieldInputClass}
 placeholder={
 !tagsState.canAddMore
 ? "Maximum tags reached"
 : "Type a tag and press Enter..."
 }
 value={tagsState.input}
 maxLength={10}
 onChange={(e) => tagsActions.setInput(e.target.value)}
 onKeyDown={tagsActions.handleInputKeyDown}
 />
 <Button
 type="button"
 variant="ghost"
 size="sm"
 disabled={
 isSaving || !tagsState.input.trim() || !tagsState.canAddMore
 }
 onClick={() => tagsActions.addTag(tagsState.input)}
 className={cn(
 panelButtonBaseClass,
 panelButtonActiveClass,
 "min-w-8 px-3",
 )}
 >
 <Plus className="w-4 h-4" />
 </Button>
 </div>

 {/* Tags Display Box */}
 <div className="mt-2 min-h-[40px] rounded-lg border border-theme-border-subtle bg-theme-bg-edit-form/35 p-3">
 {tagsState.tags.length > 0 ? (
 <div className="flex flex-wrap gap-2">
 {tagsState.tags.map((tag, index) => (
 <Badge
 key={index}
 variant="secondary"
 className="flex h-6.5 items-center gap-1 rounded-lg border-theme-channel-type-active-border bg-theme-channel-type-active-bg px-2 text-theme-channel-type-active-text"
 >
 {tag}
 <button
 type="button"
 onClick={() => tagsActions.removeTag(index)}
 disabled={isSaving}
 className="ml-1 cursor-pointer border border-transparent p-0.5 hover:border-white/10 hover:bg-white/10"
 >
 <X className="h-3 w-3" />
 </button>
 </Badge>
 ))}
 </div>
 ) : (
 <p className="text-xs text-theme-text-muted text-center py-2">
 No tags added yet. Add tags to show on your profile.
 </p>
 )}
 </div>

 <p className="text-xs text-theme-text-muted mt-1">
 {tagsState.count}/{tagsState.maxTags} tags
 </p>
 </div>
 );
});

// Languages Section

export const LanguagesSection = memo(function LanguagesSection({
 mainLanguage,
 secondaryLanguages,
 isSaving,
 onMainLanguageChange,
 onAddSecondaryLanguage,
 onRemoveSecondaryLanguage,
 t,
}: LanguagesSectionProps) {
 const [isSecondaryLanguagesOpen, setIsSecondaryLanguagesOpen] =
 useState(false);

 return (
 <div className="space-y-0.5 -mt-1 -mb-5">
 {/* Main Language */}
 <div className="space-y-2">
 <label
 htmlFor="profile-main-language"
 className="uppercase text-xs font-bold text-theme-text-subtle"
 >
 {t.profile.mainLanguage}
 </label>
 <Select
 name="profile-main-language"
 disabled={isSaving}
 value={mainLanguage}
 onValueChange={(value) => onMainLanguageChange(value as Languages)}
 >
 <SelectTrigger
 id="profile-main-language"
 size="sm"
 className={panelSelectTriggerClass}
 >
 <SelectValue />
 </SelectTrigger>
 <SelectContent className={panelSelectContentClass}>
 {Object.values(Languages).map((lang) => (
 <SelectItem
 key={lang}
 value={lang}
 className={panelSelectItemClass}
 >
 {lang === Languages.EN ? "English" : "Español"}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 <p className="text-xs text-theme-text-muted">
 {t.profile.mainLanguageDescription}
 </p>
 </div>
 {/* Secondary Languages */}
 <div className="space-y-2 ">
 <label
 htmlFor="profile-secondary-languages"
 className="uppercase text-xs font-bold text-theme-text-subtle"
 >
 {t.profile.secondaryLanguages}
 </label>
 <div className="space-y-3">
 <Select
 name="profile-secondary-languages"
 disabled={isSaving}
 open={secondaryLanguages.length > 0 ? false : isSecondaryLanguagesOpen}
 onOpenChange={(nextOpen) => {
 if (secondaryLanguages.length > 0) {
 setIsSecondaryLanguagesOpen(false);
 return;
 }

 setIsSecondaryLanguagesOpen(nextOpen);
 }}
 onValueChange={(value) =>
 onAddSecondaryLanguage(value as Languages)
 }
 >
 <SelectTrigger
 id="profile-secondary-languages"
 size="sm"
 className={panelSelectTriggerClass}
 >
 <span className="truncate">
 {secondaryLanguages.length > 0
 ? secondaryLanguages
 .map((lang) =>
 lang === Languages.EN ? "English" : "Español",
 )
 .join(", ")
 : t.profile.addLanguage}
 </span>
 </SelectTrigger>
 <SelectContent className={panelSelectContentClass}>
 {Object.values(Languages)
 .filter(
 (lang) =>
 lang !== mainLanguage && !secondaryLanguages.includes(lang),
 )
 .map((lang) => (
 <SelectItem
 key={lang}
 value={lang}
 className={panelSelectItemClass}
 >
 {lang === Languages.EN ? "English" : "Español"}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>

 {/* Selected Secondary Languages */}
 {false && secondaryLanguages.length > 0 && (
 <div className="flex flex-wrap gap-2">
 {secondaryLanguages.map((lang) => (
 <Badge
 key={lang}
 variant="secondary"
 className="flex h-8 items-center gap-1 rounded-lg border-theme-channel-type-active-border bg-theme-channel-type-active-bg px-2 text-theme-channel-type-active-text"
 >
 {lang === Languages.EN ? "English" : "Español"}
 <button
 type="button"
 onClick={() => onRemoveSecondaryLanguage(lang)}
 className="ml-1 cursor-pointer border border-transparent p-0.5 hover:border-white/10 hover:bg-white/10"
 >
 <X className="h-3 w-3" />
 </button>
 </Badge>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>
 );
});

// Account Info Section (Read-only)

export const AccountInfoSection = memo(function AccountInfoSection({
 email,
 visibleId,
 t,
}: AccountInfoSectionProps) {
 return (
 <div className="space-y-6 pt-0 -mt-2 -mb-2">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 -mt-2.5">
 {/* Email (Read-only) */}
 <div>
 <label
 htmlFor="profile-email"
 className="uppercase text-xs font-bold text-theme-text-subtle"
 >
 {t.profile.email}
 </label>
 <Input
 id="profile-email"
 name="profile-email"
 disabled
 className={cn(readonlyFieldInputClass, " cursor-not-allowed")}
 value={email}
 />
 </div>

 {/* User ID (Read-only) */}
 <div>
 <label
 htmlFor="profile-user-id"
 className="uppercase text-xs font-bold text-theme-text-subtle"
 >
 {t.profile.userId}
 </label>
 <Input
 id="profile-user-id"
 name="profile-user-id"
 disabled
 className={cn(
 readonlyFieldInputClass,
 " cursor-not-allowed font-mono text-xs",
 )}
 value={visibleId}
 />
 </div>
 </div>
 </div>
 );
});
