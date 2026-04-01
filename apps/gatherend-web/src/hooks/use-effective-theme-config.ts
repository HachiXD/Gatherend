"use client";

import { useMemo } from "react";
import { useProfile } from "@/components/app-shell/providers/profile-provider";
import {
  getThemeMode,
  hasThemeGradient,
  parseThemeConfig,
} from "@/lib/theme/runtime";
import type { ThemeConfig, ThemeMode } from "@/lib/theme/types";
import { useThemePreviewStore } from "@/stores/theme-preview-store";

export function useEffectiveThemeConfig(): ThemeConfig | null {
  const profile = useProfile();
  const previewConfig = useThemePreviewStore((state) => state.previewConfig);

  return useMemo(() => {
    if (previewConfig) {
      return previewConfig;
    }

    return parseThemeConfig(profile.themeConfig);
  }, [previewConfig, profile.themeConfig]);
}

export function useEffectiveThemeMode(): ThemeMode {
  const themeConfig = useEffectiveThemeConfig();
  return useMemo(() => getThemeMode(themeConfig), [themeConfig]);
}

export function useHasEffectiveThemeGradient(): boolean {
  const themeConfig = useEffectiveThemeConfig();
  return useMemo(() => hasThemeGradient(themeConfig), [themeConfig]);
}
