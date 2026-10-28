import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// What the access token carries. Nothing secret: anyone holding the token can read it.
export interface AccessTokenPayload {
  sub: string; // user _id
  sid: string; // session _id
}

export type AccessTokenCheck =
  { status: 'valid'; userId: string; sessionId: string } | { status: 'expired' } | { status: 'invalid' };

export const ACCESS_TOKEN_SECONDS = Math.round(env.accessTokenMinutes * 60);

export function signAccessToken(userId: string, sessionId: string): string {
  const payload: AccessTokenPayload = { sub: userId, sid: sessionId };
  return jwt.sign(payload, env.jwtSecret, { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_SECONDS });
}

function readPayload(decoded: unknown): { userId: string; sessionId: string } | null {
  if (typeof decoded !== 'object' || decoded === null) return null;
  const { sub, sid } = decoded as Record<string, unknown>;
  return typeof sub === 'string' && typeof sid === 'string' ? { userId: sub, sessionId: sid } : null;
}

// Checks the signature and the expiry time. No database: this is what makes access tokens fast.
export function verifyAccessToken(token: string): AccessTokenCheck {
  try {
    const ids = readPayload(jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] }));
    return ids ? { status: 'valid', ...ids } : { status: 'invalid' };
  } catch (err) {
    return err instanceof jwt.TokenExpiredError ? { status: 'expired' } : { status: 'invalid' };
  }
}

// For logout only: a signed token that has expired still tells us which session to end.
export function readAccessTokenIgnoringExpiry(token: string): { userId: string; sessionId: string } | null {
  try {
    return readPayload(jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'], ignoreExpiration: true }));
  } catch {
    return null;
  }
}
