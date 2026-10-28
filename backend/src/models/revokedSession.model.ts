import { Schema, Types, model } from 'mongoose';
import type { HydratedDocument } from 'mongoose';

// Why a login was ended. Kept for debugging and for an activity log later.
export const REVOKE_REASONS = [
  'logout',
  'logout_all',
  'password_reset',
  'blocked',
  'deleted',
  'token_reuse',
] as const;
export type RevokeReason = (typeof REVOKE_REASONS)[number];

/**
 * The blacklist. An access token is a JWT that works until it expires, even after logout.
 * When a session ends, its id is written here; requireAuth refuses any access token with that id.
 * A row is needed only while such an access token could still be alive, so MongoDB removes it
 * by itself shortly after (expiresAt, TTL index). The collection stays tiny.
 */
export interface IRevokedSession {
  sessionId: Types.ObjectId;
  userId: Types.ObjectId;
  reason: RevokeReason;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type RevokedSessionDocument = HydratedDocument<IRevokedSession>;

const revokedSessionSchema = new Schema<IRevokedSession>(
  {
    sessionId: { type: Schema.Types.ObjectId, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, enum: REVOKE_REASONS, required: true },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true },
);

export const RevokedSession = model<IRevokedSession>('RevokedSession', revokedSessionSchema);
