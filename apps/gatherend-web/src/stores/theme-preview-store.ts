"use client";

import { create } from "zustand";
import type { ThemeConfig } from "@/lib/theme/types";

interface ThemePreviewStore {
  previewConfig: ThemeConfig | null;
  persistedConfig: ThemeConfig | null | undefined;
  setPreviewConfig: (config: ThemeConfig | null) => void;
  setPersistedConfig: (config: ThemeConfig | null) => void;
  clearPreviewConfig: () => void;
  clearPersistedConfig: () => void;
}

export const useThemePreviewStore = create<ThemePreviewStore>((set) => ({
  previewConfig: null,
  persistedConfig: undefined,
  setPreviewConfig: (config) => set({ previewConfig: config }),
  setPersistedConfig: (config) => set({ persistedConfig: config }),
  clearPreviewConfig: () => set({ previewConfig: null }),
  clearPersistedConfig: () => set({ persistedConfig: undefined }),
}));
