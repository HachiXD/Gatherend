"use client";

import { cn } from "@/lib/utils";
import {
  Flag,
  Users,
  BarChart3,
  Shield,
  Search,
  History,
  SearchCheck,
  ShieldEllipsis,
} from "lucide-react";
import { useTranslation } from "@/i18n";

export type ModerationTab =
  | "reports"
  | "history"
  | "banned-users"
  | "user-lookup"
  | "board-lookup"
  | "pending-investigations"
  | "stats";

interface ModerationSidebarProps {
  tab: ModerationTab;
  setTab: (tab: ModerationTab) => void;
}

export const ModerationSidebar = ({ tab, setTab }: ModerationSidebarProps) => {
  const { t } = useTranslation();
  const items: { id: ModerationTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "reports",
      label: t.moderation.reports,
      icon: <Flag className="w-4 h-4" />,
    },
    {
      id: "history",
      label: t.moderation.history,
      icon: <History className="w-4 h-4" />,
    },
    {
      id: "banned-users",
      label: t.moderation.bannedUsers,
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: "user-lookup",
      label: t.moderation.userLookup,
      icon: <Search className="w-4 h-4" />,
    },
    {
      id: "board-lookup",
      label: t.moderation.boardLookup,
      icon: <ShieldEllipsis className="w-4 h-4" />,
    },
    {
      id: "pending-investigations",
      label: t.moderation.pendingInvestigations,
      icon: <SearchCheck className="w-4 h-4" />,
    },
    {
      id: "stats",
      label: t.moderation.stats,
      icon: <BarChart3 className="w-4 h-4" />,
    },
  ];

  return (
    <aside className="flex w-full flex-col border-b border-theme-border bg-theme-bg-overlay-primary/85 p-3 sm:w-52 sm:border-b-0 sm:border-r sm:p-4">
      <div className="border border-theme-border bg-theme-bg-secondary/25 px-2.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.24)]">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-red-400" />
          <h2 className="truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-theme-text-muted">
            {t.moderation.dashboard}
          </h2>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2 border px-3 py-2 text-left text-sm font-medium transition",
              tab === item.id
                ? "border-theme-border-accent-active-channel bg-theme-bg-secondary/40 text-theme-text-light shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.28)]"
                : "border-transparent text-theme-text-subtle hover:border-theme-border hover:bg-theme-bg-secondary/30 hover:text-theme-text-light hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.24)]",
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
    </aside>
  );
};
