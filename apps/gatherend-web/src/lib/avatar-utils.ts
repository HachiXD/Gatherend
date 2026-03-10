// Utilidades compartidas para generación de avatares de boards

// Generar un color HEX consistente basado en un string (para Dicebear)
export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Generar color HSL con saturación y luminosidad agradables
  const hue = Math.abs(hash % 360);
  const saturation = 65 + (Math.abs(hash >> 8) % 20); // 65-85%
  const lightness = 45 + (Math.abs(hash >> 16) % 15); // 45-60%
  // Convertir HSL a HEX
  const h = hue / 360;
  const s = saturation / 100;
  const l = lightness / 100;
  const hue2rgb = (p: number, q: number, t: number) => {
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

// Normalizar URL de imagen (puede venir como JSON string)
export function normalizeImageUrl(
  url: string | null | undefined,
): string | null {
  if (!url || url.trim() === "") return null;
  if (url.startsWith("{")) {
    try {
      const parsed = JSON.parse(url);
      if (parsed.url && typeof parsed.url === "string") {
        return normalizeDicebearRasterUrl(parsed.url);
      }
    } catch {
      // No es JSON válido
    }
  }
  return normalizeDicebearRasterUrl(url);
}

function normalizeDicebearRasterUrl(url: string): string {
  try {
    const u = new URL(url);
    const dicebearHost = process.env.NEXT_PUBLIC_DICEBEAR_URL
      ? new URL(process.env.NEXT_PUBLIC_DICEBEAR_URL).hostname
      : null;
    if (!dicebearHost || u.hostname !== dicebearHost) return url;

    const parts = u.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1]?.toLowerCase();
    if (last !== "png") return url;

    parts[parts.length - 1] = "webp";
    u.pathname = `/${parts.join("/")}`;
    u.searchParams.delete("format");
    return u.toString();
  } catch {
    return url;
  }
}

// Generar URL de avatar automático de Dicebear para un board
export function generateBoardAvatarUrl(
  boardId: string,
  boardName: string,
  size: number = 256,
): string | null {
  if (!process.env.NEXT_PUBLIC_DICEBEAR_URL) return null;
  // Usar Array.from para manejar correctamente emojis y caracteres Unicode
  // (los emojis son 2 unidades UTF-16, [0] rompería el par surrogado)
  const chars = Array.from(boardName || "G");
  const firstChar = chars[0] || "G";

  // Si es un emoji u otro carácter no-ASCII, usar la primera letra del boardId como fallback
  // encodeURIComponent falla con pares surrogados incompletos
  const isSimpleChar = /^[a-zA-Z0-9]$/.test(firstChar);
  const safeLetter = isSimpleChar
    ? firstChar.toUpperCase()
    : boardId[0]?.toUpperCase() || "G";

  const bgColor = stringToColor(boardId);
  const rasterSize = Math.min(256, Math.max(1, Math.round(size)));
  return `${process.env.NEXT_PUBLIC_DICEBEAR_URL}/9.x/initials/webp?seed=${encodeURIComponent(
    safeLetter,
  )}&backgroundColor=${bgColor}&size=${rasterSize}`;
}

// Obtener la URL final de imagen del board (normalizada o auto-generada)
export function getBoardImageUrl(
  imageUrl: string | null | undefined,
  boardId: string,
  boardName: string,
  size: number = 256,
): string | null {
  const normalizedUrl = normalizeImageUrl(imageUrl);
  if (normalizedUrl) {
    return normalizedUrl;
  }
  return generateBoardAvatarUrl(boardId, boardName, size);
}

// Verificar si una URL es de Dicebear
export function isDicebearUrl(url: string): boolean {
  if (!process.env.NEXT_PUBLIC_DICEBEAR_URL) return false;
  try {
    const dicebearHost = new URL(process.env.NEXT_PUBLIC_DICEBEAR_URL).hostname;
    return url.includes(dicebearHost);
  } catch {
    return false;
  }
}

// Avatares de Perfil (usando DiceBear Thumbs)

/**
 * Genera un avatar de perfil usando DiceBear Thumbs.
 * Usa el ID del perfil como seed para garantizar consistencia.
 * @param profileId - ID único del perfil (usado como seed)
 * @param size - Tamaño del avatar en píxeles (default: 256)
 */
export function generateProfileAvatarUrl(
  profileId: string,
  size: number = 256,
): string | null {
  if (!process.env.NEXT_PUBLIC_DICEBEAR_URL) return null;
  const bgColor = stringToColor(profileId);
  const rasterSize = Math.min(256, Math.max(1, Math.round(size)));
  return `${process.env.NEXT_PUBLIC_DICEBEAR_URL}/9.x/thumbs/webp?seed=${encodeURIComponent(
    profileId,
  )}&backgroundColor=${bgColor}&size=${rasterSize}`;
}

/**
 * Obtiene la URL de avatar de un perfil.
 * Si tiene imagen personalizada, la devuelve.
 * Si no, genera un avatar con DiceBear Thumbs.
 * @param imageUrl - URL de imagen del perfil (puede ser null/vacía)
 * @param profileId - ID del perfil para generar avatar de fallback
 * @param size - Tamaño del avatar
 */
export function getProfileAvatarUrl(
  imageUrl: string | null | undefined,
  profileId: string,
  size: number = 256,
): string | null {
  const normalizedUrl = normalizeImageUrl(imageUrl);
  if (normalizedUrl && normalizedUrl.trim() !== "") {
    return normalizedUrl;
  }
  return generateProfileAvatarUrl(profileId, size);
}
