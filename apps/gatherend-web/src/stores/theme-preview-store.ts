"use client";

import { create } from "zustand";
import type { ThemeConfig } from "@/lib/theme/types";

interface ThemePreviewStore {
  previewConfig: ThemeConfig | null;
  setPreviewConfig: (config: ThemeConfig | null) => void;
  clearPreviewConfig: () => void;
}

export const useThemePreviewStore = create<ThemePreviewStore>((set) => ({
  previewConfig: null,
  setPreviewConfig: (config) => set({ previewConfig: config }),
  clearPreviewConfig: () => set({ previewConfig: null }),
}));
