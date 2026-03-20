"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { User, Palette, Users, SquarePen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOverlayStore } from "@/hooks/use-overlay-store";
import { useProfile } from "@/components/app-shell/providers/profile-provider";
import { ThemeModal } from "@/components/modals/theme-modal";
import { MyCommunitiesModal } from "@/components/modals/my-communities-modal";
import type { ThemeConfig } from "@/lib/theme/types";
import { useTranslation } from "@/i18n";
import { getOptimizedStaticUiImageUrl } from "@/lib/ui-image-optimizer";

export function CustomUserButton() {
  // Obtener perfil desde el contexto (React Query - se actualiza automáticamente)
  const profile = useProfile();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isCommunitiesModalOpen, setIsCommunitiesModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { onOpen: onOpenOverlay } = useOverlayStore();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Usar datos del profile (fuente de verdad para SPA client-side)
  const avatarUrl = profile.avatarAsset?.url || "";
  const userName = profile.username || "User";
  const discriminator = profile.discriminator || null;
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [forceOriginalImage, setForceOriginalImage] = useState(false);
  const menuPanelShadow =
    "shadow-[0_10px_24px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.1),inset_1px_0_0_rgba(255,255,255,0.08),inset_-1px_0_0_rgba(0,0,0,0.38),inset_0_-1px_0_rgba(0,0,0,0.38)]";
  const menuRowClass =
    "h-8 w-full cursor-pointer rounded-none border border-transparent px-3 py-2 text-left text-sm text-theme-text-secondary hover:border-theme-border hover:bg-theme-bg-secondary/30 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.28)] focus:border-theme-border focus:bg-theme-bg-secondary/30 focus:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.28)]";
  const identityPlateClass =
    "border border-theme-border bg-theme-bg-secondary/25 px-2.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.24)]";

  useEffect(() => {
    setAvatarFailed(false);
    setForceOriginalImage(false);
  }, [avatarUrl]);

  const displayImageUrl32 = useMemo(() => {
    if (!avatarUrl) return "";
    if (forceOriginalImage) return avatarUrl;
    return getOptimizedStaticUiImageUrl(avatarUrl, {
      w: 32,
      h: 32,
      q: 82,
      resize: "fill",
      gravity: "sm",
    });
  }, [forceOriginalImage, avatarUrl]);

  const displayImageUrl40 = useMemo(() => {
    if (!avatarUrl) return "";
    if (forceOriginalImage) return avatarUrl;
    return getOptimizedStaticUiImageUrl(avatarUrl, {
      w: 40,
      h: 40,
      q: 82,
      resize: "fill",
      gravity: "sm",
    });
  }, [forceOriginalImage, avatarUrl]);

  const handleAvatarError = () => {
    if (!forceOriginalImage && avatarUrl) {
      setForceOriginalImage(true);
      return;
    }
    setAvatarFailed(true);
  };

  const handleProfileClick = () => {
    setIsOpen(false);
    onOpenOverlay("profileSettings", { user: profile });
  };

  const handleThemeClick = () => {
    setIsOpen(false);
    setIsThemeModalOpen(true);
  };

  const handleCommunitiesClick = () => {
    setIsOpen(false);
    setIsCommunitiesModalOpen(true);
  };

  // Parse themeConfig from profile (Json field from Prisma)
  const themeConfig = (profile as { themeConfig?: unknown })
    .themeConfig as ThemeConfig | null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative flex items-center justify-center",
          "w-8 h-8 rounded-full overflow-hidden",
          "bg-zinc-700",
          "hover:opacity-80 transition-opacity",
          "focus:outline-none focus:ring-2 cursor-pointer focus:ring-theme-accent-custom-user-button focus:ring-offset-2 focus:ring-offset-theme-bg-primary",
        )}
        aria-label={t.userMenu.userMenuLabel}
      >
        {avatarUrl && displayImageUrl32 && !avatarFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayImageUrl32}
            alt={userName}
            className="w-full h-full object-cover"
            loading="eager"
            decoding="async"
            onError={handleAvatarError}
          />
        ) : (
          <User className="w-4 h-4 text-theme-text-secondary" />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            "absolute right-0 top-full mt-2",
            "w-56 rounded-none",
            "bg-theme-bg-dropdown-menu-primary",
            "border border-theme-border",
            "z-50",
            "animate-in fade-in slide-in-from-top-2 duration-200",
            menuPanelShadow,
          )}
        >
          {/* User Info Section */}
          <div className="border-b border-theme-border px-3 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-theme-border bg-theme-bg-secondary/40 ">
                {avatarUrl && displayImageUrl40 && !avatarFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={displayImageUrl40}
                    alt={userName}
                    className="w-full h-full object-cover"
                    loading="eager"
                    decoding="async"
                    onError={handleAvatarError}
                  />
                ) : (
                  <User className="w-5 h-5 text-theme-text-secondary" />
                )}
              </div>
              <div className={cn("min-w-0 flex-1", identityPlateClass)}>
                <p className="truncate border-b border-theme-border pb-0.5 text-sm font-semibold text-theme-text-primary">
                  {userName}
                  {discriminator && (
                    <span className="text-theme-text-tertiary font-normal">
                      /{discriminator}
                    </span>
                  )}
                </p>
                <p className="truncate pt-0.5 text-[11px] text-theme-text-tertiary">
                  {profile.email}
                </p>
              </div>
            </div>
          </div>

          {/* Menu Options */}
          <div className="px-1 py-0.5">
            <button
              onClick={handleProfileClick}
              className={cn(menuRowClass, "flex items-center gap-2")}
            >
              <SquarePen className="w-4 h-4" />
              {t.userMenu.profile}
            </button>
            <button
              onClick={handleThemeClick}
              className={cn(menuRowClass, "flex items-center gap-2")}
            >
              <Palette className="w-4 h-4" />
              {t.userMenu.myTheme}
            </button>
            <button
              onClick={handleCommunitiesClick}
              className={cn(menuRowClass, "flex items-center gap-2")}
            >
              <Users className="w-4 h-4" />
              {t.userMenu.myCommunities}
            </button>
          </div>
        </div>
      )}

      {/* Theme Modal */}
      <ThemeModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
        currentThemeConfig={themeConfig}
      />

      {/* My Communities Modal */}
      <MyCommunitiesModal
        isOpen={isCommunitiesModalOpen}
        onClose={() => setIsCommunitiesModalOpen(false)}
      />
    </div>
  );
}
