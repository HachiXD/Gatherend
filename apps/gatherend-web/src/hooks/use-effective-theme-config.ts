"use client";

import { useEffect, useMemo } from "react";
import { useProfile } from "@/components/app-shell/providers/profile-provider";
import {
  areThemeConfigsEqual,
  getThemeMode,
  hasThemeGradient,
  normalizeThemeConfig,
  parseThemeConfig,
} from "@/lib/theme/runtime";
import type { ThemeConfig, ThemeMode } from "@/lib/theme/types";
import { useThemePreviewStore } from "@/stores/theme-preview-store";

export function useEffectiveThemeConfig(): ThemeConfig | null {
  const profile = useProfile();
  const previewConfig = useThemePreviewStore((state) => state.previewConfig);
  const persistedConfig = useThemePreviewStore((state) => state.persistedConfig);
  const clearPersistedConfig = useThemePreviewStore(
    (state) => state.clearPersistedConfig,
  );
  const profileThemeConfig = useMemo(
    () => normalizeThemeConfig(parseThemeConfig(profile.themeConfig)),
    [profile.themeConfig],
  );

  useEffect(() => {
    if (
      persistedConfig !== undefined &&
      areThemeConfigsEqual(persistedConfig, profileThemeConfig)
    ) {
      clearPersistedConfig();
    }
  }, [clearPersistedConfig, persistedConfig, profileThemeConfig]);

  return useMemo(() => {
    if (previewConfig) {
      return normalizeThemeConfig(previewConfig);
    }

    if (persistedConfig !== undefined) {
      return normalizeThemeConfig(persistedConfig);
    }

    return profileThemeConfig;
  }, [persistedConfig, previewConfig, profileThemeConfig]);
}

export function useEffectiveThemeMode(): ThemeMode {
  const themeConfig = useEffectiveThemeConfig();
  return useMemo(() => getThemeMode(themeConfig), [themeConfig]);
}

export function useHasEffectiveThemeGradient(): boolean {
  const themeConfig = useEffectiveThemeConfig();
  return useMemo(() => hasThemeGradient(themeConfig), [themeConfig]);
}
