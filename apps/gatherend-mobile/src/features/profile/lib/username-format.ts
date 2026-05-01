export interface UsernameFormatConfig {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

/**
 * Parse usernameFormat from API response.
 * Handles both legacy enum values (NORMAL, BOLD, ITALIC) and the new JSON format.
 */
export function parseUsernameFormat(
  format: unknown,
): UsernameFormatConfig {
  if (!format) return {};

  // Legacy string enum format
  if (typeof format === "string") {
    switch (format) {
      case "BOLD":
        return { bold: true };
      case "ITALIC":
        return { italic: true };
      case "NORMAL":
      default:
        return {};
    }
  }

  // New JSON format
  if (typeof format === "object" && format !== null && !Array.isArray(format)) {
    const obj = format as Record<string, unknown>;
    return {
      bold: obj.bold === true,
      italic: obj.italic === true,
      underline: obj.underline === true,
    };
  }

  return {};
}
