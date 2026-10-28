import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

// A long random value for links (e-mail verification, reset token).
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

// A 6-digit code, e.g. "042917".
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

// What we store instead of the real value. Keyed with the server secret, so a leaked
// database cannot be used to guess 6-digit codes offline.
export function hashToken(value: string): string {
  return createHmac('sha256', env.jwtSecret).update(value).digest('hex');
}

// Compares two hashes in constant time.
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
