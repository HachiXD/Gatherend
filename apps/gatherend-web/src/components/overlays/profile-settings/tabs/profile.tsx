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
import { useUpdateCachedProfiles } from "@/hooks/use-update-cached-profiles";
import { useTranslation, localeToLanguage, languageToLocale } from "@/i18n";
import { Button } from "@/components/ui/button";

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
  UsernameSection,
  UsernameColorSection,
  AboutMeSection,
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
    .max(32, { message: "Username must be at most 32 characters" }),
  avatarAssetId: z.string().optional().nullable(),
  badge: z
    .string()
    .max(30, { message: "Badge must be at most 30 characters" })
    .optional()
    .nullable(),
  badgeStickerId: z.string().optional().nullable(),
  longDescription: z
    .string()
    .max(200, { message: "Description must be at most 200 characters" })
    .optional()
    .nullable(),
});

type FormSchema = z.infer<typeof schema>;

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
  const { updateCachedProfiles } = useUpdateCachedProfiles();
  const { locale, setLocale, t } = useTranslation();
  const panelShellClass =
    "border border-theme-border bg-theme-bg-overlay-primary/78 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.26)] sm:px-5 sm:py-5";
  const sectionTitleClass =
    "border-b border-theme-border -mt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-theme-text-muted";

  // Form State (react-hook-form for simple fields only)

  const form = useForm<FormSchema>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: user.username,
      avatarAssetId: user.avatarAssetId || "",
      badge: extendedUser.badge || "",
      badgeStickerId: extendedUser.badgeStickerId || "",
      longDescription: extendedUser.longDescription || "",
    },
  });

  const [isSaving, setIsSaving] = useState(false);

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
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { startUpload } = useUpload("profile_avatar", {
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

  // Form Submission

  const onSubmit = useCallback(
    async (values: FormSchema) => {
      try {
        setIsSaving(true);

        const updatedProfileData = {
          username: values.username,
          avatarAssetId: values.avatarAssetId,
          languages: selectedLanguages,
          usernameColor: usernameColor.buildColor(),
          profileTags: profileTags.state.tags,
          badge: values.badge || null,
          badgeStickerId: values.badgeStickerId || null,
          usernameFormat: usernameFormat.buildFormat(),
          longDescription: values.longDescription || null,
        };

        const response = await axios.patch("/api/profile", updatedProfileData);
        const serverProfile = response.data;

        // Update React Query cache (simplified - let invalidation handle the rest)
        queryClient.setQueryData(
          ["current-profile"],
          (oldProfile: ClientProfile | undefined) =>
            oldProfile ? { ...oldProfile, ...serverProfile } : serverProfile,
        );

        // Update cached profiles in all chat messages
        // This ensures changes like username color, format, etc. are reflected immediately
        updateCachedProfiles(user.id, {
          username: serverProfile.username,
          discriminator: serverProfile.discriminator,
          avatarAsset: serverProfile.avatarAsset,
          usernameColor: serverProfile.usernameColor,
          usernameFormat: serverProfile.usernameFormat,
          profileTags: serverProfile.profileTags,
          badge: serverProfile.badge,
          badgeSticker: serverProfile.badgeSticker,
          longDescription: serverProfile.longDescription,
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
      usernameColor,
      profileTags.state.tags,
      usernameFormat,
      queryClient,
      invalidateProfileCard,
      updateCachedProfiles,
      user.id,
      params?.boardId,
      t.profile.updateSuccess,
      t.profile.updateError,
    ],
  );

  // Memoized form values (avoid watch() re-renders)

  // Use getValues with a controlled re-render trigger via form state
  const { username, longDescription, badge, badgeStickerId } = form.watch();

  // Render

  const isSubmitDisabled =
    isSaving ||
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

        {/* SECTION 1: IDENTITY (Avatar & Username) */}
        <section className={panelShellClass}>
          <div className="-mt-3 -mb-2.5 flex flex-col items-start gap-8 md:flex-row">
            <div className="md:self-center">
              <AvatarSection
                imagePreview={imagePreview}
                username={user.username}
                uploading={uploading}
                isSaving={isSaving}
                onUploadClick={handleUploadClick}
                t={t}
              />
            </div>
            <div className="-mt-1 w-full flex-1 space-y-2">
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
          </div>
        </section>

        {/* SECTION 2: DETAILS */}
        <section className={panelShellClass}>
          <h3 className={sectionTitleClass}>{t.profile.profileDetails}</h3>
          <div className="mt-1 space-y-1.5">
            <AboutMeSection
              value={longDescription}
              isSaving={isSaving}
              onChange={(value) => form.setValue("longDescription", value)}
              t={t}
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
              className="h-6.5 min-w-[120px] -my-3 cursor-pointer rounded-none bg-theme-tab-button-bg px-3 text-[14px] text-theme-text-light hover:bg-theme-tab-button-hover"
            >
              {isSaving ? t.profile.saving : t.profile.saveChanges}
            </Button>
          </div>
        </section>
      </form>
    </div>
  );
};
