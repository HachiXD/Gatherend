"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

import { ProfileTab } from "@/components/overlays/profile-settings/tabs/profile";
import { ProfileSettingsSidebar } from "./tabs/sidebar";
import type { ClientProfile } from "@/hooks/use-current-profile";

// Skeleton for settings overlay loading
function SettingsOverlaySkeleton() {
  return (
    <div className="w-52 space-y-3">
      <div className="h-5 w-3/4 animate-pulse bg-white/10" />
      <div className="h-8 w-full animate-pulse border border-white/8 bg-white/5" />
      <div className="h-8 w-2/3 animate-pulse border border-white/8 bg-white/5" />
    </div>
  );
}

interface ProfileSettingsOverlayProps {
  user: ClientProfile;
  onClose: () => void;
}

export const ProfileSettingsOverlay = ({
  user,
  onClose,
}: ProfileSettingsOverlayProps) => {
  const [tab, setTab] = useState<"profile">("profile");
  const overlayShellShadow =
    "shadow-[0_18px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08),inset_1px_0_0_rgba(255,255,255,0.06),inset_-1px_0_0_rgba(0,0,0,0.42),inset_0_-1px_0_rgba(0,0,0,0.42)]";

  if (typeof document === "undefined") {
    return null;
  }

  if (!user) {
    return createPortal(
      <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6">
        <div
          className={cn(
            "border border-theme-border bg-theme-bg-overlay-primary p-8",
            overlayShellShadow,
          )}
        >
          <SettingsOverlaySkeleton />
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-6 overflow-y-auto overscroll-contain pointer-events-auto">
      <div
        className={cn(
          "relative flex h-[calc(100dvh-1rem)] w-full max-w-4xl flex-col overflow-hidden border border-theme-border bg-theme-bg-overlay-primary sm:h-[calc(100dvh-3rem)] sm:flex-row",
          "animate-in fade-in zoom-in duration-150",
          overlayShellShadow,
        )}
      >
        {/* SIDEBAR */}
        <ProfileSettingsSidebar tab={tab} setTab={setTab} onClose={onClose} />

        {/* MAIN PANEL */}
        <div className="scrollbar-navigation flex-1 overflow-y-auto border-t border-theme-border bg-theme-bg-quaternary/35 p-4 sm:border-t-0 sm:border-l sm:p-6">
          {tab === "profile" && <ProfileTab user={user} />}
        </div>

        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          className="absolute right-2 top-2 cursor-pointer text-theme-text-subtle transition hover:text-theme-text-light"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>,
    document.body,
  );
};
