"use client";

import { useEffect, useState } from "react";

type AccentVars = { [key: string]: string };

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  const sl = s / 100;
  const ll = l / 100;
  const a = sl * Math.min(ll, 1 - ll);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = ll - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function deriveAccentVars(hex: string): AccentVars {
  const [h, s, l] = hexToHsl(hex);
  // Clamp for dark theme readability
  const cs = Math.max(30, Math.min(70, s));
  const cl = Math.max(30, Math.min(55, l));
  return {
    // Accent
    "--theme-accent-primary": hslToHex(h, cs, cl),
    "--theme-channel-active": hslToHex(h, Math.round(cs * 0.5), Math.round(cl * 0.8)),
    "--theme-channel-type-active-border": hslToHex(h, cs, Math.min(60, Math.round(cl * 1.1))),
    "--theme-channel-type-active-bg": `hsla(${h}, ${cs}%, ${cl}%, 0.4)`,
    "--theme-border-accent-active-channel": hslToHex(h, cs, Math.round(cl * 0.9)),
    // Backgrounds
    "--theme-channel-bg": hslToHex(h, Math.round(cs * 0.55), 18),
    "--theme-bg-overlay-primary": hslToHex(h, Math.round(cs * 0.45), 12),
    "--theme-bg-edit-form": hslToHex(h, Math.round(cs * 0.5), 22),
    "--leftbar-bg": hslToHex(h, Math.round(cs * 0.5), 14),
  };
}

async function extractDominantColor(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 50;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no ctx"));
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        // Skip near-black and near-white pixels
        if (brightness < 20 || brightness > 235) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }
      if (count === 0) return reject(new Error("no valid pixels"));
      resolve(
        `#${Math.round(r / count).toString(16).padStart(2, "0")}` +
        `${Math.round(g / count).toString(16).padStart(2, "0")}` +
        `${Math.round(b / count).toString(16).padStart(2, "0")}`,
      );
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = url;
  });
}

export function useBoardAccent(imageUrl: string | null | undefined): AccentVars | null {
  const [accentVars, setAccentVars] = useState<AccentVars | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      // Use a microtask to avoid synchronous setState inside effect
      const t = setTimeout(() => setAccentVars(null), 0);
      return () => clearTimeout(t);
    }
    let cancelled = false;
    extractDominantColor(imageUrl)
      .then((hex) => {
        if (!cancelled) setAccentVars(deriveAccentVars(hex));
      })
      .catch(() => {
        if (!cancelled) setAccentVars(null);
      });
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  return accentVars;
}
