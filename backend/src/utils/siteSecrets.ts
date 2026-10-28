import { randomBytes } from 'node:crypto';

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Unbiased random letters and digits (bytes >= 248 are skipped, so every character is equally likely). */
export function randomAlnum(length: number): string {
  let out = '';
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte < 248) out += ALNUM[byte % 62];
      if (out.length === length) break;
    }
  }
  return out;
}

/** Site key: "tw_pub_" + 32 letters/digits (the collector's format). Public: it sits in every page. */
export const newPublicKey = () => `tw_pub_${randomAlnum(32)}`;

/** Id of a key inside a site (for "revoke this key"). */
export const newKeyId = () => `k_${randomAlnum(12)}`;

/** Server-only secret for the daily visitor hashes (64 hex characters). Goes only to Cloudflare KV. */
export const newIdentitySecret = () => randomBytes(32).toString('hex');

/** "tw_pub_AbC1…": enough to tell keys apart in the activity log, never the whole key. */
export const shortKey = (key: string) => `${key.slice(0, 11)}…`;
