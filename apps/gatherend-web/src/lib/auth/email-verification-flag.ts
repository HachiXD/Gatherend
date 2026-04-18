import "server-only";

const ENABLED_VALUES = new Set(["true", "1", "yes", "on"]);

export function isEmailVerificationEnabled(): boolean {
  const rawValue = process.env.EMAIL_VERIFICATION_ENABLED;
  if (!rawValue) return false;

  return ENABLED_VALUES.has(rawValue.trim().toLowerCase());
}
