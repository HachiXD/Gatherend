"use client";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";

interface SidebarProps {
 tab: "profile";
 setTab: (tab: "profile") => void;
 onClose: () => void;
}

export const ProfileSettingsSidebar = ({
 tab,
 setTab,
 onClose,
}: SidebarProps) => {
 const { t } = useTranslation();
 const tabClass =
 "w-full whitespace-nowrap rounded-lg border px-3 py-2 text-left text-sm font-medium transition";

 return (
 <div className="flex w-full flex-col rounded-lg border-b border-theme-border bg-theme-bg-overlay-primary/85 p-3 sm:w-40 sm:border-b-0 sm:p-3 md:w-60 md:p-4">
 <div className="rounded-lg border border-theme-border bg-theme-bg-secondary/25 px-2.5 py-1 ">
 <h2 className="truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-theme-text-muted">
 {t.overlays.profileSettings.title}
 </h2>
 </div>

 <div className="mt-3 space-y-1.5">
 <button
 onClick={() => setTab("profile")}
 className={cn(
 tabClass,
 tab === "profile"
 ? "border-theme-border-accent-active-channel cursor-pointer bg-theme-bg-secondary/40 text-theme-text-light "
 : "border-transparent cursor-pointer text-theme-text-subtle hover:border-theme-border hover:bg-theme-bg-secondary/30 hover:text-theme-text-light ",
 )}
 >
 {t.overlays.profileSettings.tabs.profile}
 </button>
 </div>
 </div>
 );
};
