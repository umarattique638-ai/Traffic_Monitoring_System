import { Schema, model } from 'mongoose';
import type { HydratedDocument } from 'mongoose';

// Everyone who signs up is an admin of their own account. Super admins manage every user.
export const ROLES = ['admin', 'super_admin'] as const;
export type Role = (typeof ROLES)[number];

export interface IUser {
  name: string;
  email: string;
  password: string; // bcrypt hash, never the plain password
  role: Role;
  isEmailVerified: boolean;
  emailVerifiedAt: Date | null;
  passwordChangedAt: Date | null;
  // A blocked user cannot log in or refresh; a super admin sets this.
  isBlocked: boolean;
  blockedAt: Date | null;
  blockedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<IUser>;

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // select: false means queries leave the hash out unless we ask for it with .select('+password').
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'admin', index: true },
    // A user can log in only after clicking the link in the verification e-mail.
    isEmailVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },
    isBlocked: { type: Boolean, default: false },
    blockedAt: { type: Date, default: null },
    blockedReason: { type: String, default: null, maxlength: 200 },
  },
  { timestamps: true },
);

export const User = model<IUser>('User', userSchema);
