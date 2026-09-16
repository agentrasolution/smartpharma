import crypto from "crypto";

const LOWERCASE = "abcdefghijkmnpqrstuvwxyz";
const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.<>?";

const GROUPS = [LOWERCASE, UPPERCASE, DIGITS, SYMBOLS];

export const PASSWORD_MIN_LENGTH = 8;
export const TEMPORARY_PASSWORD_LENGTH = 12;

/**
 * Generates a cryptographically-secure temporary password that contains at
 * least one lowercase, uppercase, digit and symbol character.
 */
export function generateTemporaryPassword(length = TEMPORARY_PASSWORD_LENGTH): string {
  const picks: string[] = [];
  for (const group of GROUPS) {
    picks.push(group[crypto.randomInt(group.length)]!);
  }
  const pool = GROUPS.join("");
  while (picks.length < length) {
    picks.push(pool[crypto.randomInt(pool.length)]!);
  }
  // Fisher-Yates shuffle with crypto randomness
  for (let i = picks.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [picks[i], picks[j]] = [picks[j]!, picks[i]!];
  }
  return picks.join("");
}

/**
 * Validates a user-chosen password. Returns an error message or null when valid.
 */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (!/[a-z]/.test(password)) {
    return "Password must contain a lowercase letter";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain an uppercase letter";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain a number";
  }
  return null;
}