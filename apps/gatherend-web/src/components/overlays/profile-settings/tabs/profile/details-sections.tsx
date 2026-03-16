"use client";

import { memo, useState } from "react";
import { X, Plus, Check } from "lucide-react";
import { Languages } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  AboutMeSectionProps,
  BadgeSectionProps,
  ProfileTagsSectionProps,
  LanguagesSectionProps,
  AccountInfoSectionProps,
} from "./types";

// About Me Section

export const AboutMeSection = memo(function AboutMeSection({
  value,
  isSaving,
  onChange,
  t,
}: AboutMeSectionProps) {
  return (
    <div className="space-y-2">
      <label
        htmlFor="profile-about-me"
        className="uppercase text-xs font-bold text-theme-text-subtle"
      >
        {t.profile.aboutMe}
      </label>
      <div className="relative w-full">
        <Textarea
          id="profile-about-me"
          name="profile-about-me"
          disabled={isSaving}
          className="w-full bg-theme-bg-input border-0 focus-visible:ring-2 focus-visible:ring-theme-accent-primary text-theme-text-light resize-none min-h-[100px] break-all"
          placeholder={t.profile.aboutMePlaceholder}
          maxLength={200}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="absolute right-3 bottom-3 text-xs text-theme-text-muted">
          {(value || "").length}/200
        </span>
      </div>
    </div>
  );
});

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
  const selectedSticker =
    myStickers.find((sticker) => sticker.id === badgeStickerId) || null;

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
            className="w-full bg-theme-bg-input border-0 focus-visible:ring-2 focus-visible:ring-theme-accent-primary text-theme-text-light resize-none break-all"
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
      <div className="space-y-2">
        <span
          id="badge-sticker-label"
          className="uppercase text-xs font-bold text-theme-text-subtle block"
        >
          {t.profile.badgeSticker}
        </span>
        <div
          className="space-y-3 min-h-[120px]"
          role="group"
          aria-labelledby="badge-sticker-label"
        >
          {/* Current selection preview */}
          {selectedSticker?.asset?.url && (
            <div className="flex items-center gap-2 p-2 bg-theme-bg-input rounded-md">
              <div className="relative h-8 w-8">
                <AnimatedSticker
                  src={selectedSticker.asset.url}
                  alt="Badge sticker"
                  containerClassName="h-full w-full"
                  fallbackWidthPx={32}
                  fallbackHeightPx={32}
                />
              </div>
              <span className="text-sm text-theme-text-subtle flex-1 truncate">
                {t.profile.selectedSticker}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onBadgeStickerIdChange("")}
                className="text-theme-text-muted hover:text-theme-text-light h-6 w-6 p-0"
                aria-label="Remove badge sticker"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          )}

          {/* Sticker selection grid */}
          {stickersEnabled ? (
            myStickers.length > 0 ? (
              <div className="grid grid-cols-6 gap-2 max-h-[120px] overflow-y-auto p-2 bg-theme-bg-input rounded-md">
                {myStickers.map((sticker) => (
                  <button
                    key={sticker.id}
                    type="button"
                    onClick={() => onBadgeStickerIdChange(sticker.id)}
                    className={`relative h-10 w-10 rounded-md hover:bg-theme-accent-primary cursor-pointer transition p-1 ${
                      badgeStickerId === sticker.id
                        ? "ring-2 ring-theme-accent-primary"
                        : ""
                    }`}
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
                      <div className="absolute -top-1 -right-1 bg-theme-accent-primary rounded-full p-0.5">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-theme-text-muted bg-theme-bg-input rounded-md border border-theme-border-secondary">
                {stickersLoading
                  ? t.profile.loadingStickers
                  : t.profile.noStickers}
              </div>
            )
          ) : (
            <div className="p-4 text-center text-sm text-theme-text-muted bg-theme-bg-input rounded-md border border-theme-border-secondary cursor-pointer hover:bg-theme-bg-secondary transition">
              Click to load stickers
            </div>
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
    <div className="space-y-2">
      <label
        htmlFor="profile-tag-input"
        className="uppercase text-xs font-bold text-theme-text-subtle"
      >
        Profile Tags
      </label>
      <p className="text-xs text-theme-text-muted mb-2">
        Add up to 10 short tags (max 10 characters each) like
        &quot;Hispano&quot;, &quot;19yo&quot;, &quot;Furry&quot;, etc.
      </p>

      {/* Tag Input */}
      <div className="flex items-center gap-2">
        <Input
          id="profile-tag-input"
          name="profile-tag-input"
          disabled={isSaving || !tagsState.canAddMore}
          className="bg-theme-bg-input border-0 focus-visible:ring-2 focus-visible:ring-theme-accent-primary text-theme-text-light"
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
          className="bg-theme-tab-button-bg hover:bg-theme-tab-button-hover text-white h-10 px-3"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Tags Display Box */}
      <div className="mt-2 p-3 bg-theme-bg-input rounded-md min-h-[60px]">
        {tagsState.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tagsState.tags.map((tag, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="flex items-center gap-1 bg-theme-accent-primary/20 text-theme-accent-primary border border-theme-accent-primary/30 hover:bg-theme-accent-primary/30"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => tagsActions.removeTag(index)}
                  disabled={isSaving}
                  className="ml-1 hover:bg-white/10 cursor-pointer rounded-full p-0.5"
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
  return (
    <div className="space-y-4">
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
            className="bg-theme-bg-input cursor-pointer border-0 focus:ring-2 focus:ring-theme-accent-primary text-theme-text-light"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(Languages).map((lang) => (
              <SelectItem key={lang} value={lang}>
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
      <div className="space-y-2">
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
            onValueChange={(value) =>
              onAddSecondaryLanguage(value as Languages)
            }
          >
            <SelectTrigger
              id="profile-secondary-languages"
              className="bg-theme-bg-input cursor-pointer border-0 focus:ring-2 focus:ring-theme-accent-primary text-theme-text-light"
            >
              <SelectValue placeholder={t.profile.addLanguage} />
            </SelectTrigger>
            <SelectContent>
              {Object.values(Languages)
                .filter(
                  (lang) =>
                    lang !== mainLanguage && !secondaryLanguages.includes(lang),
                )
                .map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {lang === Languages.EN ? "English" : "Español"}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          {/* Selected Secondary Languages */}
          {secondaryLanguages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {secondaryLanguages.map((lang) => (
                <Badge
                  key={lang}
                  variant="secondary"
                  className="flex items-center gap-1 bg-theme-tab-button-bg text-white hover:bg-theme-tab-button-hover"
                >
                  {lang === Languages.EN ? "English" : "Español"}
                  <button
                    type="button"
                    onClick={() => onRemoveSecondaryLanguage(lang)}
                    className="ml-1 hover:bg-white/10 cursor-pointer rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-theme-text-muted">
          {t.profile.secondaryLanguagesDescription}
        </p>
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
    <div className="space-y-6 pt-0 -mt-2">
      <h3 className="text-lg font-semibold text-theme-text-light border-b border-theme-border-secondary pb-2">
        {t.profile.accountInfo}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 -mt-2">
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
            className="bg-theme-bg-input border-0 text-theme-text-muted cursor-not-allowed mt-2"
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
            className="bg-theme-bg-input border-0 text-theme-text-muted cursor-not-allowed font-mono text-xs mt-2"
            value={visibleId}
          />
        </div>
      </div>
    </div>
  );
});
