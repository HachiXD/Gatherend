"use client";

import { memo } from "react";
import { Pencil } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import type { AvatarSectionProps } from "./types";

export const AvatarSection = memo(function AvatarSection({
  profileId,
  imagePreview,
  usernameColor,
  uploading,
  isSaving,
  onUploadClick,
  t,
}: AvatarSectionProps) {
  return (
    <div className="shrink-0 mx-auto md:mx-0">
      <div className="relative w-32 h-32 mx-auto group">
        {/* Avatar Image */}
        <div className="w-full h-full rounded-full overflow-hidden ring-4 ring-theme-bg-primary shadow-lg">
          <UserAvatar
            src={imagePreview || undefined}
            profileId={profileId}
            usernameColor={usernameColor}
            showStatus={false}
            className="h-32 w-32"
            animationMode="never"
          />
        </div>

        {/* Plus Button Overlay */}
        <button
          type="button"
          onClick={onUploadClick}
          disabled={uploading || isSaving}
          className="absolute bottom-0 bg-theme-tab-button-bg cursor-pointer right-0 w-10 h-10 rounded-full hover:bg-theme-tab-button-hover text-white flex items-center justify-center shadow-lg transition-all hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={t.profile.editAvatar}
        >
          <Pencil className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
      {uploading && (
        <p className="text-xs text-center text-theme-text-muted mt-2">
          {t.profile.uploading}
        </p>
      )}
    </div>
  );
});
