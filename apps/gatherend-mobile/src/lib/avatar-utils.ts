import { dicebearBaseUrl } from "./env";

export function stringToColor(str: string): string {
  let hash = 0;

  for (let i = 0; i < str.length; i += 1) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash % 360);
  const saturation = 65 + (Math.abs(hash >> 8) % 20);
  const lightness = 45 + (Math.abs(hash >> 16) % 15);
  const h = hue / 360;
  const s = saturation / 100;
  const l = lightness / 100;

  const hue2rgb = (p: number, q: number, tValue: number) => {
    let t = tValue;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

  return `${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function normalizeImageUrl(
  url: string | null | undefined,
): string | null {
  if (!url || url.trim() === "") return null;

  if (url.startsWith("{")) {
    try {
      const parsed = JSON.parse(url) as { url?: unknown };

      if (typeof parsed.url === "string") {
        return normalizeDicebearRasterUrl(parsed.url);
      }
    } catch {
      return null;
    }
  }

  return normalizeDicebearRasterUrl(url);
}

function normalizeDicebearRasterUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    const dicebearHost = new URL(dicebearBaseUrl).hostname;

    if (parsedUrl.hostname !== dicebearHost) return url;

    const parts = parsedUrl.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1]?.toLowerCase();

    if (last !== "png") return url;

    parts[parts.length - 1] = "webp";
    parsedUrl.pathname = `/${parts.join("/")}`;
    parsedUrl.searchParams.delete("format");

    return parsedUrl.toString();
  } catch {
    return url;
  }
}

export function generateBoardAvatarUrl(
  boardId: string,
  boardName: string,
  size = 256,
): string {
  const chars = Array.from(boardName || "G");
  const firstChar = chars[0] || "G";
  const isSimpleChar = /^[a-zA-Z0-9]$/.test(firstChar);
  const safeLetter = isSimpleChar
    ? firstChar.toUpperCase()
    : boardId[0]?.toUpperCase() || "G";
  const bgColor = stringToColor(boardId);
  const rasterSize = Math.min(256, Math.max(1, Math.round(size)));

  return `${dicebearBaseUrl}/9.x/initials/webp?seed=${encodeURIComponent(
    safeLetter,
  )}&backgroundColor=${bgColor}&size=${rasterSize}`;
}

export function getBoardImageUrl(
  imageUrl: string | null | undefined,
  boardId: string,
  boardName: string,
  size = 256,
): string {
  return (
    normalizeImageUrl(imageUrl) ?? generateBoardAvatarUrl(boardId, boardName, size)
  );
}
