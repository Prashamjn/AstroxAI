/**
 * Username rules: unique, must end with "astai", only lowercase letters + numbers, no spaces.
 * Valid: prashamastai, codekingastai, astroxdevastai
 * Invalid: Prasham, prasham_ai, prashamASTAI
 */

export const USERNAME_SUFFIX = "astai";
export const USERNAME_MIN_LENGTH = 6; // e.g. xastai
export const USERNAME_MAX_LENGTH = 32;

const USERNAME_REGEX = /^[a-z0-9]+astai$/;

export function validateUsernameFormat(username) {
  // Normalize: trim, lowercase, remove any character that isn't a-z or 0-9 (fixes hidden/special chars)
  const raw = String(username ?? "").trim().toLowerCase();
  const s = raw.replace(/[^a-z0-9]/g, "");
  if (s.length < USERNAME_MIN_LENGTH) return { valid: false, error: "Username too short (min 6 characters)." };
  if (s.length > USERNAME_MAX_LENGTH) return { valid: false, error: "Username too long (max 32 characters)." };
  if (!USERNAME_REGEX.test(s)) return { valid: false, error: "Must be lowercase letters and numbers only, and end with 'astai' (e.g. codekingastai)." };
  return { valid: true, normalized: s };
}

export function getUsernameError(username) {
  return validateUsernameFormat(username).error || null;
}
