/**
 * Password hashing helpers (node:crypto scrypt — no external dependencies).
 * Stored format: "scrypt:<salt hex>:<hash hex>"
 *
 * Kept free of Next.js imports so it can also be used by prisma/seed.ts.
 */

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, salt, hash] = stored.split(":");
    if (scheme !== "scrypt" || !salt || !hash) return false;
    const candidate = scryptSync(password, salt, KEY_LENGTH);
    const expected = Buffer.from(hash, "hex");
    return (
      candidate.length === expected.length && timingSafeEqual(candidate, expected)
    );
  } catch {
    return false;
  }
}
