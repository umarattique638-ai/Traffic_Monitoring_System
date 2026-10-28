import type { Types } from 'mongoose';
import { RESEND_COOLDOWN_MS } from '../config/auth.constants.js';
import { Token } from '../models/token.model.js';
import type { TokenDocument, TokenType } from '../models/token.model.js';
import { AppError } from '../utils/AppError.js';
import { hashToken } from '../utils/crypto.js';

// One-time tokens: e-mail verification links, reset codes (OTP) and reset tokens. Only hashes are stored.
export const tokenService = {
  // Saves a new token and deletes older ones of the same kind, so only the newest link or code works.
  async issue(userId: Types.ObjectId, type: TokenType, value: string, ttlMs: number): Promise<void> {
    await Token.deleteMany({ userId, type });
    await Token.create({ userId, type, hash: hashToken(value), expiresAt: new Date(Date.now() + ttlMs) });
  },

  // Finds an unexpired token by its value and deletes it in the same step, so it works only once.
  consume(type: TokenType, value: string): Promise<TokenDocument | null> {
    return Token.findOneAndDelete({ type, hash: hashToken(value), expiresAt: { $gt: new Date() } });
  },

  // The user's current, unexpired token of one kind (OTP codes are checked per user).
  findActive(userId: Types.ObjectId, type: TokenType): Promise<TokenDocument | null> {
    return Token.findOne({ userId, type, expiresAt: { $gt: new Date() } });
  },

  // Deletes every token of one kind for a user.
  async remove(userId: Types.ObjectId, type: TokenType): Promise<void> {
    await Token.deleteMany({ userId, type });
  },

  // Deletes all of a user's tokens (account deleted).
  async removeAll(userId: Types.ObjectId): Promise<void> {
    await Token.deleteMany({ userId });
  },

  // Stops the same e-mail being sent again and again: at most one per RESEND_COOLDOWN_MS.
  async assertCooldown(userId: Types.ObjectId, type: TokenType): Promise<void> {
    const last = await Token.findOne({ userId, type }).sort({ createdAt: -1 });
    if (!last) return;

    const waitMs = last.createdAt.getTime() + RESEND_COOLDOWN_MS - Date.now();
    if (waitMs > 0) {
      const seconds = Math.ceil(waitMs / 1000);
      throw AppError.tooManyRequests(
        `Please wait ${seconds} seconds before asking again.`,
        'wait_before_retry',
      );
    }
  },
};
