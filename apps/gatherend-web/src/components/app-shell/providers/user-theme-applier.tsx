"use client";

import { useLayoutEffect } from "react";
import { applyGradientToDOM, applyThemeToDOM } from "@/lib/theme/utils";
import { resolveThemeColors } from "@/lib/theme/runtime";
import { useEffectiveThemeConfig } from "@/hooks/use-effective-theme-config";

/**
 * Applies the current user's theme to the DOM.
 *
 * This is intentionally isolated from AppShell so changes in session/profile/theme
 * don't force a render of the layout chrome.
 */
export function UserThemeApplier() {
  const themeConfig = useEffectiveThemeConfig();
  const themeConfigKey = JSON.stringify(themeConfig || null);

  useLayoutEffect(() => {
    const colors = resolveThemeColors(themeConfig);
    applyThemeToDOM(colors);
    applyGradientToDOM(themeConfig?.gradient || null);
  }, [themeConfig, themeConfigKey]);

  return null;
}
