"use client";

import { AppSettings } from "./app-settings";
import { CustomUserButton } from "./custom-user-button";
import { ModerationButton } from "./moderation-button";
import { useState, useEffect } from "react";
import { useIsAdmin } from "@/hooks/use-is-admin";

export function BoardHeader() {
  const [mounted, setMounted] = useState(false);
  const { isAdmin } = useIsAdmin();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="relative flex items-center h-full w-full px-4">
      {/* RIGHT SIDE */}
      <div className="ml-auto flex items-center gap-3">
        {mounted && isAdmin && <ModerationButton />}
        {mounted && <CustomUserButton />}
        <AppSettings />
      </div>
    </div>
  );
}
