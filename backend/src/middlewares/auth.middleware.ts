import type { NextFunction, Request, Response } from 'express';
import { sessionService } from '../services/session.service.js';
import { AppError } from '../utils/AppError.js';
import { ACCESS_COOKIE } from '../utils/cookie.js';
import { verifyAccessToken } from '../utils/jwt.js';

/**
 * Lets the request through only with a valid access token, and puts the user's ids on req.auth.
 *   1. JWT: right signature and not expired (no database).
 *   2. Blacklist: the token's session has not been ended (logout, block, password reset...).
 * When the token has expired, the frontend calls POST /auth/refresh and tries again.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token: unknown = req.cookies?.[ACCESS_COOKIE];
  if (typeof token !== 'string' || !token) throw AppError.unauthorized();

  const check = verifyAccessToken(token);
  if (check.status === 'expired')
    throw AppError.unauthorized('Your access token has expired.', 'token_expired');
  if (check.status === 'invalid') throw AppError.unauthorized();

  if (await sessionService.isRevoked(check.sessionId)) {
    throw AppError.unauthorized('This session has ended. Please log in again.', 'session_revoked');
  }

  req.auth = { userId: check.userId, sessionId: check.sessionId };
  next();
}
