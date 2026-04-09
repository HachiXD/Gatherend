"use client";

import { useState, useEffect, useRef } from "react";
import { Palette, SquarePen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOverlayStore } from "@/hooks/use-overlay-store";
import { useProfile } from "@/components/app-shell/providers/profile-provider";
import { ThemeModal } from "@/components/modals/theme-modal";
import { normalizeThemeConfig, parseThemeConfig } from "@/lib/theme/runtime";
import { useTranslation } from "@/i18n";
import { UserAvatar } from "@/components/user-avatar";

export function CustomUserButton() {
  // Obtener perfil desde el contexto (React Query - se actualiza automáticamente)
  const profile = useProfile();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
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
  const userName = profile.username || "User";
  const discriminator = profile.discriminator || null;
  const menuPanelShadow =
    "shadow-[0_10px_24px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.1),inset_1px_0_0_rgba(255,255,255,0.08),inset_-1px_0_0_rgba(0,0,0,0.38),inset_0_-1px_0_rgba(0,0,0,0.38)]";
  const menuRowClass =
    "h-8 w-full cursor-pointer rounded-none border border-transparent px-3 py-2 text-left text-sm text-theme-text-secondary hover:border-theme-border hover:bg-theme-bg-secondary/30 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.28)] focus:border-theme-border focus:bg-theme-bg-secondary/30 focus:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.28)]";
  const identityPlateClass =
    "border border-theme-border bg-theme-bg-secondary/25 px-2.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.24)]";

  const handleProfileClick = () => {
    setIsOpen(false);
    onOpenOverlay("profileSettings", { user: profile });
  };

  const handleThemeClick = () => {
    setIsOpen(false);
    setIsThemeModalOpen(true);
  };

  const themeConfig = normalizeThemeConfig(parseThemeConfig(profile.themeConfig));

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative flex items-center justify-center",
          "w-8 h-8 rounded-full overflow-hidden",
          "hover:opacity-80 transition-opacity",
          "focus:outline-none focus:ring-2 cursor-pointer focus:ring-theme-accent-custom-user-button focus:ring-offset-2 focus:ring-offset-theme-bg-primary",
        )}
        aria-label={t.userMenu.userMenuLabel}
      >
        <UserAvatar
          src={profile.avatarAsset?.url || undefined}
          profileId={profile.id}
          usernameColor={profile.usernameColor}
          showStatus={false}
          className="h-8 w-8"
          animationMode="never"
        />
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
              <UserAvatar
                src={profile.avatarAsset?.url || undefined}
                profileId={profile.id}
                usernameColor={profile.usernameColor}
                showStatus={false}
                className="h-10 w-10 shrink-0"
                animationMode="never"
              />
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
          </div>
        </div>
      )}

      {/* Theme Modal */}
      <ThemeModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
        currentThemeConfig={themeConfig}
      />

    </div>
  );
}
