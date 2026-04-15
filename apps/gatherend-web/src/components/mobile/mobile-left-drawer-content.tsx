"use client";

import { ReactNode } from "react";

interface MobileLeftDrawerContentProps {
  navigationSidebar: ReactNode;
  leftbar: ReactNode;
}

export function MobileLeftDrawerContent({
  navigationSidebar,
  leftbar,
}: MobileLeftDrawerContentProps) {
  return (
    <div className="flex h-full min-h-0">
      {/* Navigation Sidebar - Boards grid */}
      <div className="w-[72px] flex-shrink-0 overflow-y-auto bg-theme-bg-primary border-r border-theme-border-secondary">
        {navigationSidebar}
      </div>

      {/* Board Leftbar - Channels */}
      <div className="min-w-0 flex-1 overflow-y-auto bg-theme-bg-secondary">
        {leftbar}
      </div>
    </div>
  );
}
