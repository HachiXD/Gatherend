/**
 * Username utilities
 *
 * Re-exports all username-related functions for backward compatibility
 * and convenient imports.
 */

// Discriminator generation and verification
export {
  MAX_DISCRIMINATORS,
  isDiscriminatorAvailable,
  generateUniqueDiscriminator,
} from "./discriminator";

// Username sanitization and validation
export {
  normalizeUsername,
  sanitizeUsername,
  validateUsername,
} from "./sanitize";

// Username formatting and parsing
export { formatFullUsername, parseFullUsername } from "./format";

// Random username generation
export { generateRandomUsername } from "./random";

// Profile queries by username
export { findProfileByFullUsername, findProfilesByUsername } from "./queries";

// Username change logic
export { changeUsername } from "./change";
