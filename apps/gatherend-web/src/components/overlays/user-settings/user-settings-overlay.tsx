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
  <div className="h-5 w-3/4 animate-pulse rounded-lg bg-white/10" />
  <div className="h-4 w-full animate-pulse rounded-lg bg-white/5" />
  <div className="h-4 w-2/3 animate-pulse rounded-lg bg-white/5" />
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
 <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-2 backdrop-blur-sm sm:p-6">
 <div
 className={cn(
 "rounded-lg border border-theme-border bg-theme-bg-overlay-primary p-8",
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
 <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto overscroll-contain bg-black/40 p-2 backdrop-blur-sm pointer-events-auto sm:items-center sm:p-6">
  <div
  className={cn(
  "relative flex h-[calc(100dvh-1rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-theme-border bg-theme-bg-overlay-primary sm:h-[calc(100dvh-3rem)]",
  "animate-in fade-in zoom-in duration-150",
  overlayShellShadow,
  )}
  >
 <UserSettingsSidebar tab={tab} setTab={setTab} />

 {/* MAIN PANEL */}
  <div className="scrollbar-navigation flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-theme-border bg-theme-bg-quaternary/35 p-4 sm:p-6">
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
  "absolute right-2 top-2 cursor-pointer p-1 text-theme-text-subtle transition hover:text-theme-text-light",
  isBlocking ? "cursor-not-allowed opacity-50" : "",
  )}
  >
  <X className="h-5 w-5" />
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
