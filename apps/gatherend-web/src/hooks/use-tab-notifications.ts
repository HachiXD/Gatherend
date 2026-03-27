"use client";

import { useEffect, useRef, useState } from "react";
import { useUnreadStore } from "./use-unread-store";
import { useMentionStore } from "./use-mention-store";

const ORIGINAL_FAVICON = "/GATHEREND_SQUARE_RELLENADO.svg";

function getFaviconLink(): HTMLLinkElement {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  return link;
}

function getBadgeColor(): string {
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue("--theme-border-accent-active-channel")
      .trim() || "#ef4444"
  );
}

// Draws the base favicon onto a 32x32 canvas, then overlays a themed badge if total > 0
function setFaviconBadge(total: number) {
  const link = getFaviconLink();

  if (total === 0) {
    link.href = ORIGINAL_FAVICON;
    return;
  }

  const badgeColor = getBadgeColor();

  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, 32, 32);

    // Circle badge in top-right corner using theme color
    ctx.beginPath();
    ctx.arc(22, 10, 10, 0, 2 * Math.PI);
    ctx.fillStyle = badgeColor;
    ctx.fill();

    ctx.fillStyle = "white";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(total > 99 ? "99+" : String(total), 22, 12);

    link.href = canvas.toDataURL("image/png");
  };
  img.src = ORIGINAL_FAVICON;
}

export function useTabNotifications() {
  const dmUnreads = useUnreadStore((state) => state.dmUnreads);
  const mentionMap = useMentionStore((state) => state.mentions);

  const baseTitleRef = useRef<string>("");
  // Increments whenever applyThemeToDOM mutates <html style="...">
  const [themeVersion, setThemeVersion] = useState(0);

  // Capture the base title once on mount to avoid issues if it's stale
  useEffect(() => {
    baseTitleRef.current = document.title.replace(/^\(\d+\)\s*/, "");
  }, []);

  // Watch for the specific CSS variable used by the badge.
  // Only triggers a redraw if --theme-border-accent-active-channel actually changed.
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout>;
    let lastColor = getBadgeColor();

    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const newColor = getBadgeColor();
        if (newColor !== lastColor) {
          lastColor = newColor;
          setThemeVersion((v) => v + 1);
        }
      }, 50);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
    });
    return () => {
      clearTimeout(debounceTimer);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const dmTotal = Object.values(dmUnreads).reduce((a, b) => a + b, 0);
    const mentionTotal = Object.values(mentionMap).filter(Boolean).length;
    const total = dmTotal + mentionTotal;

    const base =
      baseTitleRef.current || document.title.replace(/^\(\d+\)\s*/, "");

    if (total > 0) {
      document.title = `(${total}) ${base}`;
    } else {
      document.title = base;
    }

    setFaviconBadge(total);
    // themeVersion triggers a favicon redraw with the fresh badge color
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dmUnreads, mentionMap, themeVersion]);

  // Restore title and favicon on unmount
  useEffect(() => {
    return () => {
      document.title =
        baseTitleRef.current || document.title.replace(/^\(\d+\)\s*/, "");
      getFaviconLink().href = ORIGINAL_FAVICON;
    };
  }, []);
}
