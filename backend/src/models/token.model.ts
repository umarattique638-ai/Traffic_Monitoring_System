import { Schema, Types, model } from 'mongoose';
import type { HydratedDocument } from 'mongoose';

// What a token is for.
export const TOKEN_TYPES = ['email_verify', 'reset_otp', 'reset_password'] as const;
export type TokenType = (typeof TOKEN_TYPES)[number];

// One-time codes and links. Only a hash is stored; the real value exists only in the e-mail.
// A token is deleted the moment it is used, so it can never be used twice.
export interface IToken {
  userId: Types.ObjectId;
  type: TokenType;
  hash: string;
  expiresAt: Date;
  attempts: number; // wrong OTP tries
  createdAt: Date;
  updatedAt: Date;
}

export type TokenDocument = HydratedDocument<IToken>;

const tokenSchema = new Schema<IToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: TOKEN_TYPES, required: true },
    hash: { type: String, required: true, index: true },
    // TTL index: MongoDB removes expired tokens by itself (about once a minute).
    expiresAt: { type: Date, required: true, expires: 0 },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true },
);

tokenSchema.index({ userId: 1, type: 1 });

export const Token = model<IToken>('Token', tokenSchema);
