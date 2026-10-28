import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { RevokedSession } from '../models/revokedSession.model.js';
import type { RevokeReason } from '../models/revokedSession.model.js';
import { Session } from '../models/session.model.js';
import { User } from '../models/user.model.js';
import type { UserDocument } from '../models/user.model.js';
import type { AuthTokens, ClientInfo } from '../types/auth.types.js';
import { AppError } from '../utils/AppError.js';
import { hashToken, randomToken, safeEqual } from '../utils/crypto.js';
import { ACCESS_TOKEN_SECONDS, signAccessToken } from '../utils/jwt.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Two tabs can refresh at the same moment with the same token. The second one is not an attack,
// so the token that was just replaced still gets a new access token for this many milliseconds.
const ROTATION_GRACE_MS = 30 * 1000;

// A blacklist row lives as long as the longest access token for that session could,
// plus a minute for clocks that are slightly off.
const BLACKLIST_MS = ACCESS_TOKEN_SECONDS * 1000 + 60 * 1000;

// ---------- private helpers (used only in this file) ----------

// The refresh token is "<session id>.<random secret>". The id finds the session; the secret proves it.
function buildRefreshToken(sessionId: string, secret: string): string {
  return `${sessionId}.${secret}`;
}

// The opposite: splits a refresh token into its two parts, or null if it has the wrong shape.
function parseRefreshToken(token: string): { sessionId: string; secret: string } | null {
  const [sessionId, secret, extra] = token.split('.');
  if (!sessionId || !secret || extra !== undefined || !Types.ObjectId.isValid(sessionId)) return null;
  return { sessionId, secret };
}

// A session lives SESSION_DAYS after its last use, but never past its absolute end.
function nextExpiry(absoluteExpiresAt: Date): Date {
  return new Date(Math.min(Date.now() + env.sessionDays * DAY_MS, absoluteExpiresAt.getTime()));
}

const sessionExpired = () =>
  AppError.unauthorized('Your session has ended. Please log in again.', 'session_expired');

type SessionIds = { _id: Types.ObjectId; userId: Types.ObjectId };

// Puts sessions on the blacklist, so their access tokens stop working at once.
async function blacklist(sessions: SessionIds[], reason: RevokeReason): Promise<void> {
  if (sessions.length === 0) return;
  const expiresAt = new Date(Date.now() + BLACKLIST_MS);
  await RevokedSession.bulkWrite(
    sessions.map((s) => ({
      updateOne: {
        filter: { sessionId: s._id },
        update: { $setOnInsert: { sessionId: s._id, userId: s.userId, reason, expiresAt } },
        upsert: true,
      },
    })),
  );
}

// Ends sessions: blacklist first (access tokens stop), then delete (refresh tokens stop).
async function endSessions(filter: Record<string, unknown>, reason: RevokeReason): Promise<number> {
  const sessions = await Session.find(filter).select('_id userId');
  await blacklist(sessions, reason);
  const { deletedCount } = await Session.deleteMany({ _id: { $in: sessions.map((s) => s._id) } });
  return deletedCount;
}

// ---------- public API ----------

export const sessionService = {
  // Login: a new session with its first refresh token, and the first access token.
  async create(user: UserDocument, client: ClientInfo): Promise<AuthTokens> {
    const sessionId = new Types.ObjectId();
    const secret = randomToken();
    const absoluteExpiresAt = new Date(Date.now() + env.sessionMaxDays * DAY_MS);

    await Session.create({
      _id: sessionId,
      userId: user._id,
      refreshTokenHash: hashToken(secret),
      expiresAt: nextExpiry(absoluteExpiresAt),
      absoluteExpiresAt,
      userAgent: client.userAgent.slice(0, 300),
      ip: client.ip,
    });

    return {
      accessToken: signAccessToken(user._id.toString(), sessionId.toString()),
      refreshToken: buildRefreshToken(sessionId.toString(), secret),
    };
  },

  /**
   * Refresh: the old refresh token is replaced by a new one (rotation) and a new access token is made.
   * A refresh token that was already replaced means it was copied: the whole session is ended.
   */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const parsed = parseRefreshToken(refreshToken);
    if (!parsed) throw sessionExpired();

    const session = await Session.findById(parsed.sessionId);
    const now = Date.now();
    if (!session || session.expiresAt.getTime() <= now || session.absoluteExpiresAt.getTime() <= now) {
      throw sessionExpired();
    }

    const user = await User.findById(session.userId);
    if (!user || user.isBlocked) {
      await endSessions({ _id: session._id }, user ? 'blocked' : 'deleted');
      if (user?.isBlocked) {
        throw AppError.forbidden('Your account has been blocked. Please contact support.', 'account_blocked');
      }
      throw sessionExpired();
    }

    const presentedHash = hashToken(parsed.secret);
    const accessToken = signAccessToken(user._id.toString(), session._id.toString());

    // 1. The current refresh token: replace it. The condition on the hash makes this safe when two
    //    requests arrive together; only one of them can win the update.
    if (safeEqual(presentedHash, session.refreshTokenHash)) {
      const newSecret = randomToken();
      const updated = await Session.findOneAndUpdate(
        { _id: session._id, refreshTokenHash: presentedHash },
        {
          refreshTokenHash: hashToken(newSecret),
          previousRefreshTokenHash: presentedHash,
          rotatedAt: new Date(),
          expiresAt: nextExpiry(session.absoluteExpiresAt),
        },
      );
      // Another request replaced it a moment ago: same as the grace case below.
      if (!updated) return { accessToken, refreshToken: null };
      return { accessToken, refreshToken: buildRefreshToken(session._id.toString(), newSecret) };
    }

    // 2. The token replaced a few seconds ago (another tab refreshed first): allow it, keep the new one.
    const justRotated = session.rotatedAt !== null && now - session.rotatedAt.getTime() < ROTATION_GRACE_MS;
    const isPrevious =
      session.previousRefreshTokenHash !== null && safeEqual(presentedHash, session.previousRefreshTokenHash);
    if (isPrevious && justRotated) return { accessToken, refreshToken: null };

    // 3. An old token came back: someone has a copy. End this login on every copy.
    await endSessions({ _id: session._id }, 'token_reuse');
    console.warn(
      `Refresh token reuse: user ${user._id.toString()}, session ${session._id.toString()} ended.`,
    );
    throw AppError.unauthorized(
      'Your session has ended for your safety. Please log in again.',
      'refresh_token_reused',
    );
  },

  // The session behind a refresh token, if the token's secret is right (used by logout).
  async findIdByRefreshToken(refreshToken: string): Promise<string | null> {
    const parsed = parseRefreshToken(refreshToken);
    if (!parsed) return null;

    const session = await Session.findById(parsed.sessionId);
    if (!session) return null;

    const hash = hashToken(parsed.secret);
    const matches =
      safeEqual(hash, session.refreshTokenHash) ||
      (session.previousRefreshTokenHash !== null && safeEqual(hash, session.previousRefreshTokenHash));
    return matches ? session._id.toString() : null;
  },

  // Logout on this device: ends one session.
  async revoke(sessionId: string): Promise<void> {
    if (!Types.ObjectId.isValid(sessionId)) return;
    await endSessions({ _id: sessionId }, 'logout');
  },

  // Every session of a user: logout everywhere, password reset, block, account deleted.
  revokeAll(userId: Types.ObjectId | string, reason: RevokeReason): Promise<number> {
    return endSessions({ userId }, reason);
  },

  // Is this session on the blacklist? requireAuth asks this on every request.
  async isRevoked(sessionId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(sessionId)) return true;
    return (await RevokedSession.exists({ sessionId })) !== null;
  },
};
