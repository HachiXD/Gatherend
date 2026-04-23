"use client";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";

type UserSettingsTabId = "account" | "logout" | "danger";

interface UserSettingsSidebarProps {
 tab: UserSettingsTabId;
 setTab: (tab: UserSettingsTabId) => void;
}

export const UserSettingsSidebar = ({
 tab,
 setTab,
}: UserSettingsSidebarProps) => {
 const { t } = useTranslation();
  const tabClass =
  "whitespace-nowrap cursor-pointer rounded-lg border px-3 py-2 text-left text-sm font-medium transition";

 const items: Array<{
 id: UserSettingsTabId;
 label: string;
 isDanger?: boolean;
 }> = [
 { id: "account", label: t.overlays.userSettings.tabs.account },
 { id: "logout", label: t.overlays.userSettings.tabs.logout },
 {
 id: "danger",
 label: t.overlays.userSettings.tabs.dangerZone,
 isDanger: true,
 },
 ];

 return (
  <div className="border-b border-theme-border bg-theme-bg-overlay-primary/85 p-4 sm:p-5">
  <div className="inline-flex self-start rounded-lg border border-theme-border bg-theme-bg-secondary/25 px-2.5 py-1">
  <h2 className="truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-theme-text-muted">
  {t.overlays.userSettings.title}
  </h2>
 </div>

 <div className="mt-3 flex flex-wrap gap-1.5">
 {items.map((item) => (
 <button
 key={item.id}
 onClick={() => setTab(item.id)}
 className={cn(
 tabClass,
 tab === item.id
 ? item.isDanger
 ? "border-red-500/70 bg-red-600/20 text-theme-text-light "
 : "border-theme-border-accent-active-channel bg-theme-bg-secondary/40 text-theme-text-light "
 : item.isDanger
 ? "border-transparent text-red-300 hover:border-red-500/40 hover:bg-red-600/10 hover:text-red-200 "
 : "border-transparent text-theme-text-subtle hover:border-theme-border hover:bg-theme-bg-secondary/30 hover:text-theme-text-light ",
 )}
 >
 {item.label}
 </button>
 ))}
 </div>
 </div>
 );
};
