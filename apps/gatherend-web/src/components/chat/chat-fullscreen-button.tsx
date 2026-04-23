"use client";

import { useEffect, useState, useCallback } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { ActionTooltip } from "@/components/action-tooltip";

interface ChatFullscreenButtonProps {
  targetId?: string;
  disabled?: boolean;
}

export function ChatFullscreenButton({
  targetId,
  disabled = false,
}: ChatFullscreenButtonProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleChange);
    handleChange();

    return () => {
      document.removeEventListener("fullscreenchange", handleChange);
    };
  }, []);

  const onClick = useCallback(async () => {
    if (disabled) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      if (!targetId) return;
      const el = document.getElementById(targetId);
      if (!el) return;
      await el.requestFullscreen();
    } catch {
      // Ignore fullscreen errors (browser policies / unsupported).
    }
  }, [disabled, targetId]);

  const Icon = isFullscreen ? Minimize2 : Maximize2;
  const label = disabled
    ? "Full screen unavailable"
    : isFullscreen
      ? "Exit full screen"
      : "Full screen";

  return (
    <ActionTooltip side="bottom" label={label}>
      <button
        onClick={onClick}
        disabled={disabled}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-[var(--community-header-btn-muted)] transition hover:bg-theme-app-settings-hover hover:text-[var(--community-header-btn-text)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Icon className="h-6 w-6" />
      </button>
    </ActionTooltip>
  );
}
