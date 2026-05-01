import {
  createContext,
  useContext,
  useMemo,
  type Context,
  type ReactNode,
} from "react";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { parseThemeConfig, resolveThemeColors } from "./runtime";
import type { ThemeColors, ThemeConfig, ThemeMode } from "./types";

type AppTheme = {
  colors: ThemeColors;
  config: ThemeConfig | null;
  mode: ThemeMode;
};

const ThemeContext: Context<AppTheme | null> = createContext<AppTheme | null>(
  null,
);

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const profile = useProfile();

  const value = useMemo<AppTheme>(() => {
    const config = parseThemeConfig(profile.themeConfig);
    const colors = resolveThemeColors(config);

    return {
      colors,
      config,
      mode: config?.mode === "light" ? "light" : "dark",
    };
  }, [profile.themeConfig]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider.");
  }

  return context;
}
