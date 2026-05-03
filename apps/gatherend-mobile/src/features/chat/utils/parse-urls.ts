const URL_RE = /https?:\/\/[^\s<>"']+/gi;

/**
 * Extracts the first http/https URL from a string.
 * Returns null if none found.
 */
export function extractFirstUrl(text: string): string | null {
  URL_RE.lastIndex = 0;
  const match = URL_RE.exec(text);
  if (!match) return null;
  // Strip trailing punctuation that's likely not part of the URL
  return match[0].replace(/[.,!?;:'")\]]+$/, "");
}
