"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

import { AccountTab } from "./tabs/account";
import { LogoutTab } from "./tabs/logout";
import { UserDangerZoneTab } from "./tabs/danger-zone";
import { UserSettingsSidebar } from "./sidebar";
import type { ClientProfile } from "@/hooks/use-current-profile";

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
  const overlayShellShadow =
    "shadow-[0_18px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08),inset_1px_0_0_rgba(255,255,255,0.06),inset_-1px_0_0_rgba(0,0,0,0.42),inset_0_-1px_0_rgba(0,0,0,0.42)]";

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
      document.body,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex pointer-events-auto">
      <div
        className={cn(
          "relative h-full w-full border border-theme-border bg-theme-bg-overlay-primary",
          "flex flex-col overflow-hidden py-0 animate-in fade-in zoom-in duration-150",
          overlayShellShadow,
        )}
      >
        <UserSettingsSidebar tab={tab} setTab={setTab} />

        {/* MAIN PANEL */}
        <div className="scrollbar-navigation flex-1 overflow-y-auto bg-theme-bg-quaternary/35 p-4 sm:p-6">
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
            "absolute right-4 top-3 cursor-pointer p-1 text-theme-text-subtle transition hover:text-theme-text-light",
            isBlocking ? "cursor-not-allowed opacity-50" : "",
          )}
        >
          <X className="h-6 w-6" />
        </button>

        {isBlocking ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-black/25 backdrop-blur-[1px] z-50"
          />
        ) : null}
      </div>
    </div>,
    document.body,
  );
};
