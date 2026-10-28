import { env } from '../config/env.js';
import type { Role, UserDocument } from '../models/user.model.js';

// What the API sends back about a user. Never includes the password hash.
export interface UserDTO {
  id: string;
  name: string;
  email: string;
  role: Role;
  isEmailVerified: boolean;
  createdAt: Date;
}

export function toUserDTO(user: UserDocument): UserDTO {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
  };
}

// What a super admin sees about any user.
export interface AdminUserDTO extends UserDTO {
  isBlocked: boolean;
  blockedAt: Date | null;
  blockedReason: string | null;
  // Listed in SUPER_ADMIN_EMAILS: cannot be demoted, blocked or deleted from the API.
  isProtected: boolean;
  updatedAt: Date;
}

export function toAdminUserDTO(user: UserDocument): AdminUserDTO {
  return {
    ...toUserDTO(user),
    isBlocked: user.isBlocked,
    blockedAt: user.blockedAt,
    blockedReason: user.blockedReason,
    isProtected: env.superAdminEmails.includes(user.email),
    updatedAt: user.updatedAt,
  };
}
