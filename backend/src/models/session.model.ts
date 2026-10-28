import { Schema, Types, model } from 'mongoose';
import type { HydratedDocument } from 'mongoose';

// One row per login (per browser or device). It holds the refresh token, as a hash only.
// Logout deletes it; MongoDB deletes it by itself after expiresAt.
export interface ISession {
  userId: Types.ObjectId;
  refreshTokenHash: string; // the refresh token that works now
  previousRefreshTokenHash: string | null; // the one it replaced, to catch a stolen token being reused
  rotatedAt: Date | null; // when the refresh token was last replaced
  expiresAt: Date; // moves forward on every refresh (no use for SESSION_DAYS = logged out)
  absoluteExpiresAt: Date; // never moves (SESSION_MAX_DAYS after login)
  userAgent: string;
  ip: string;
  createdAt: Date;
  updatedAt: Date;
}

export type SessionDocument = HydratedDocument<ISession>;

const sessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    refreshTokenHash: { type: String, required: true },
    previousRefreshTokenHash: { type: String, default: null },
    rotatedAt: { type: Date, default: null },
    // TTL index: MongoDB removes the session once this time has passed (it checks about once a minute).
    expiresAt: { type: Date, required: true, expires: 0 },
    absoluteExpiresAt: { type: Date, required: true },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
  },
  { timestamps: true },
);

export const Session = model<ISession>('Session', sessionSchema);
