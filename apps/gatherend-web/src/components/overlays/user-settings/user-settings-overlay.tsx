"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

import { AccountTab } from "./tabs/account";
import { LogoutTab } from "./tabs/logout";
import { UserDangerZoneTab } from "./tabs/danger-zone";
import type { ClientProfile } from "@/hooks/use-current-profile";
import { useTranslation } from "@/i18n";

// Skeleton for settings overlay loading
function SettingsOverlaySkeleton() {
  return (
    <div className="w-48 space-y-3">
      <div className="h-5 bg-white/10 rounded w-3/4 animate-pulse" />
      <div className="h-4 bg-white/5 rounded w-full animate-pulse" />
      <div className="h-4 bg-white/5 rounded w-2/3 animate-pulse" />
    </div>
  );
}

interface UserSettingsOverlayProps {
  user: ClientProfile;
  onClose: () => void;
}

export const UserSettingsOverlay = ({
  user,
  onClose,
}: UserSettingsOverlayProps) => {
  const [tab, setTab] = useState<"account" | "logout" | "danger">("account");
  const [isBlocking, setIsBlocking] = useState(false);
  const { t } = useTranslation();

  if (typeof document === "undefined") {
    return null;
  }

  if (!user) {
    return createPortal(
      <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-theme-bg-overlay-primary p-8 rounded-lg">
          <SettingsOverlaySkeleton />
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex pointer-events-auto">
      <div
        className={cn(
          "relative bg-theme-bg-overlay-primary h-full w-full",
          "flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150"
        )}
      >
        {/* HORIZONTAL TABS */}
        <div className="border-b border-theme-border-secondary px-16 pt-16 pb-4">
          <h2 className="text-xs uppercase font-bold text-theme-text-muted mb-4">
            {t.overlays.userSettings.title}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setTab("account")}
              disabled={isBlocking}
              className={cn(
                "px-4 py-2 cursor-pointer rounded-md text-sm font-medium transition",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                tab === "account"
                  ? "bg-theme-tab-active-bg text-white"
                  : "hover:bg-theme-bg-tab-hover text-theme-text-subtle"
              )}
            >
              {t.overlays.userSettings.tabs.account}
            </button>

            <button
              onClick={() => setTab("logout")}
              disabled={isBlocking}
              className={cn(
                "px-4 py-2 cursor-pointer rounded-md text-sm font-medium transition",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                tab === "logout"
                  ? "bg-theme-tab-active-bg text-white"
                  : "hover:bg-theme-bg-tab-hover text-theme-text-subtle"
              )}
            >
              {t.overlays.userSettings.tabs.logout}
            </button>

            <button
              onClick={() => setTab("danger")}
              disabled={isBlocking}
              className={cn(
                "px-4 py-2 cursor-pointer rounded-md text-sm font-medium transition text-red-400",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                tab === "danger"
                  ? "bg-red-600 text-white"
                  : "hover:bg-red-600/20"
              )}
            >
              {t.overlays.userSettings.tabs.dangerZone}
            </button>
          </div>
        </div>

        {/* MAIN PANEL */}
        <div className="flex-1 px-16 py-8 overflow-y-auto">
          {tab === "account" && (
            <AccountTab
              user={user}
              onClose={onClose}
              setOverlayBlocking={setIsBlocking}
            />
          )}
          {tab === "logout" && (
            <LogoutTab
              user={user}
              onClose={onClose}
              setOverlayBlocking={setIsBlocking}
            />
          )}
          {tab === "danger" && (
            <UserDangerZoneTab
              user={user}
              onClose={onClose}
              setOverlayBlocking={setIsBlocking}
            />
          )}
        </div>

        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          disabled={isBlocking}
          className={cn(
            "absolute top-4 right-4 p-2 rounded-md transition",
            isBlocking ? "opacity-50 cursor-not-allowed" : "hover:bg-white/10"
          )}
        >
          <X className="w-5 h-5 text-theme-text-subtle" />
        </button>

        {isBlocking ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-black/25 backdrop-blur-[1px] z-50"
          />
        ) : null}
      </div>
    </div>,
    document.body
  );
};
