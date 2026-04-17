import type { CSSProperties } from "react";
import {
  chatBubbleStyleSchema,
  type ChatBubbleStyle,
} from "@/lib/chat-bubble-style";
import { clampGradientColor } from "@/lib/theme/utils";

const CHAT_BUBBLE_RADIUS_PX = 6;
const CHAT_BUBBLE_SHADOW =
  "inset 0 1px 0 rgba(255,255,255,0.16), inset -1px -1px 0 rgba(0,0,0,0.38)";

type BubblePosition = "single" | "start" | "middle" | "end" | undefined;

export function parseRenderableChatBubbleStyle(
  value: unknown,
): ChatBubbleStyle | null {
  const parsed = chatBubbleStyleSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function getChatBubbleSurfaceStyle(
  value: unknown,
  options?: {
    position?: BubblePosition;
    groupedSurface?: boolean;
    themeMode?: "dark" | "light";
  },
): CSSProperties | undefined {
  const style = parseRenderableChatBubbleStyle(value);
  if (!style) return undefined;

  const position = options?.groupedSurface ? "single" : options?.position;
  const radiusStyle = getRadiusStyle(style.roundedEnabled, position);

  const adaptedBackground =
    style.background === null
      ? "var(--color-theme-bg-overlay-primary)"
      : options?.themeMode
        ? clampGradientColor(style.background, options.themeMode)
        : style.background;

  return {
    backgroundColor: adaptedBackground,
    borderStyle: "solid",
    borderWidth: `${style.borderWidth}px`,
    borderColor:
      style.background !== null
        ? getBubbleBorderColor(adaptedBackground as string)
        : "rgba(0,0,0,0.3)",
    boxShadow: style.shadowEnabled ? CHAT_BUBBLE_SHADOW : "none",
    ...radiusStyle,
  };
}

export function getBubbleBorderColor(background: string): string {
  const rgb = parseHexToRgb(background);
  if (!rgb) {
    return "rgba(0,0,0,0.3)";
  }

  return `rgb(${mixChannel(rgb.r, 0, 0.3)} ${mixChannel(rgb.g, 0, 0.3)} ${mixChannel(rgb.b, 0, 0.3)})`;
}

function parseHexToRgb(value: string) {
  const normalized = value.trim().replace(/^#/, "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

  if (!/^[A-Fa-f0-9]{6}$/.test(expanded)) {
    return null;
  }

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

function mixChannel(source: number, target: number, weight: number) {
  return Math.round(source * (1 - weight) + target * weight);
}

function getRadiusStyle(
  roundedEnabled: boolean,
  position: BubblePosition,
): CSSProperties {
  if (!roundedEnabled) {
    return {
      borderRadius: 0,
    };
  }

  switch (position) {
    case "start":
      return {
        borderTopLeftRadius: CHAT_BUBBLE_RADIUS_PX,
        borderTopRightRadius: CHAT_BUBBLE_RADIUS_PX,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      };
    case "middle":
      return {
        borderRadius: 0,
      };
    case "end":
      return {
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderBottomLeftRadius: CHAT_BUBBLE_RADIUS_PX,
        borderBottomRightRadius: CHAT_BUBBLE_RADIUS_PX,
      };
    case "single":
    case undefined:
    default:
      return {
        borderRadius: CHAT_BUBBLE_RADIUS_PX,
      };
  }
}
