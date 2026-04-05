"use client";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";

type BoardSettingsTabId =
  | "general"
  | "members"
  | "bans"
  | "history"
  | "danger";

interface SidebarProps {
  tab: BoardSettingsTabId;
  setTab: (tab: BoardSettingsTabId) => void;
  onClose: () => void;
  showGeneralTab?: boolean;
  showMembersTab?: boolean;
  showBansTab?: boolean;
  showHistoryTab?: boolean;
  showDangerTab?: boolean;
}

export const SettingsSidebar = ({
  tab,
  setTab,
  onClose: _onClose,
  showGeneralTab = true,
  showMembersTab = true,
  showBansTab = true,
  showHistoryTab = true,
  showDangerTab = false,
}: SidebarProps) => {
  const { t } = useTranslation();
  const tabClass =
    "w-full whitespace-nowrap border px-3 py-2 text-left text-sm font-medium transition";

  const items: Array<{ id: BoardSettingsTabId; label: string }> = [
    ...(showGeneralTab
      ? [{ id: "general" as const, label: t.overlays.boardSettings.tabs.general }]
      : []),
    ...(showMembersTab
      ? [{ id: "members" as const, label: t.overlays.boardSettings.tabs.members }]
      : []),
    ...(showBansTab
      ? [{ id: "bans" as const, label: t.overlays.boardSettings.tabs.bans }]
      : []),
    ...(showHistoryTab
      ? [
          {
            id: "history" as const,
            label: t.overlays.boardSettings.tabs.history,
          },
        ]
      : []),
    ...(showDangerTab
      ? [{ id: "danger" as const, label: t.overlays.boardSettings.tabs.dangerZone }]
      : []),
  ];

  return (
    <div className="flex w-full flex-col border-b border-theme-border bg-theme-bg-overlay-primary/85 p-3 sm:w-40 sm:border-b-0 sm:p-3 md:w-60 md:p-4">
      <div className="border border-theme-border bg-theme-bg-secondary/25 px-2.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.24)]">
        <h2 className="truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-theme-text-muted">
          {t.overlays.boardSettings.title}
        </h2>
      </div>

      <div className="mt-3 space-y-1.5">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              tabClass,
              tab === item.id
                ? "border-theme-border-accent-active-channel cursor-pointer bg-theme-bg-secondary/40 text-theme-text-light shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.28)]"
                : "border-transparent cursor-pointer text-theme-text-subtle hover:border-theme-border hover:bg-theme-bg-secondary/30 hover:text-theme-text-light hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.24)]",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
};
