const RESERVED_USERNAME_CHAR_REGEX = /[@/\[\]]/u;
const DISALLOWED_USERNAME_WHITESPACE_REGEX = /[\s\u00A0]+/u;
const DISALLOWED_USERNAME_INVISIBLE_REGEX = /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u;

/**
 * Normalize a username without removing visible Unicode characters.
 */
export function normalizeUsername(username: string): string {
  return username.normalize("NFC").trim();
}

/**
 * Sanitize usernames only for derived defaults from external sources.
 * We keep visible Unicode characters and remove only reserved/invisible ones.
 */
export function sanitizeUsername(username: string): string {
  return normalizeUsername(username)
    .replace(DISALLOWED_USERNAME_WHITESPACE_REGEX, "")
    .replace(RESERVED_USERNAME_CHAR_REGEX, "")
    .replace(DISALLOWED_USERNAME_INVISIBLE_REGEX, "");
}

/**
 * Validate username characters that should be rejected rather than silently
 * mutated in user-facing flows.
 */
export function validateUsername(username: string): string | null {
  if (DISALLOWED_USERNAME_WHITESPACE_REGEX.test(username)) {
    return "Username cannot contain spaces";
  }

  if (RESERVED_USERNAME_CHAR_REGEX.test(username)) {
    return "Username cannot contain @, /, [ or ]";
  }

  if (DISALLOWED_USERNAME_INVISIBLE_REGEX.test(username)) {
    return "Username contains unsupported invisible characters";
  }

  return null;
}
