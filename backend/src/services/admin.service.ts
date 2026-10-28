import { env } from '../config/env.js';
import { Session } from '../models/session.model.js';
import { User } from '../models/user.model.js';
import type { Role, UserDocument } from '../models/user.model.js';
import type { SessionDocument } from '../models/session.model.js';
import { AppError } from '../utils/AppError.js';
import type { ListUsersQuery } from '../validators/admin.validator.js';
import { Site } from '../models/site.model.js';
import type { SiteDocument } from '../models/site.model.js';
import { accountService } from './account.service.js';
import { sessionService } from './session.service.js';

export interface UserListResult {
  users: UserDocument[];
  // Sites per user id (not deleted), for the Sites column.
  siteCounts: Map<string, number>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ---------- private helpers ----------

// Accounts listed in SUPER_ADMIN_EMAILS cannot be changed from the API.
const isProtected = (user: UserDocument) => env.superAdminEmails.includes(user.email);

// The user the super admin wants to change, or a 404.
async function findTarget(id: string): Promise<UserDocument> {
  const user = await User.findById(id);
  if (!user) throw AppError.notFound('No user with this id.', 'user_not_found');
  return user;
}

// Rules for changing another account: never yourself, never an account listed in SUPER_ADMIN_EMAILS.
function assertCanManage(actor: UserDocument, target: UserDocument, action: string): void {
  if (actor._id.equals(target._id)) {
    throw AppError.badRequest(`You cannot ${action} your own account.`, 'cannot_change_self');
  }
  if (isProtected(target)) {
    const message = `This super admin is set in the server settings; you cannot ${action} them.`;
    throw new AppError(409, 'protected_super_admin', message);
  }
}

// Characters that mean something in a regular expression are escaped, so a search is plain text.
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------- public API ----------

export const adminService = {
  // On server start: accounts in SUPER_ADMIN_EMAILS that already exist (and are verified) become super admins.
  async syncSuperAdmins(): Promise<number> {
    if (env.superAdminEmails.length === 0) return 0;
    const { modifiedCount } = await User.updateMany(
      { email: { $in: env.superAdminEmails }, isEmailVerified: true, role: { $ne: 'super_admin' } },
      { role: 'super_admin' },
    );
    return modifiedCount;
  },

  // One page of users, with search and filters.
  async listUsers(query: ListUsersQuery): Promise<UserListResult> {
    const filter: Record<string, unknown> = {};
    if (query.q) {
      const pattern = new RegExp(escapeRegex(query.q), 'i');
      filter.$or = [{ name: pattern }, { email: pattern }];
    }
    if (query.role) filter.role = query.role;
    if (query.status === 'blocked') filter.isBlocked = true;
    if (query.status === 'active') Object.assign(filter, { isBlocked: false, isEmailVerified: true });
    if (query.status === 'unverified') filter.isEmailVerified = false;

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit),
      User.countDocuments(filter),
    ]);
    const counts = await Site.aggregate<{ _id: unknown; n: number }>([
      { $match: { ownerId: { $in: users.map((u) => u._id) }, status: { $ne: 'deleted' } } },
      { $group: { _id: '$ownerId', n: { $sum: 1 } } },
    ]);
    const siteCounts = new Map(counts.map((c) => [String(c._id), c.n]));
    return { users, siteCounts, page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) };
  },

  // One user, the devices they are logged in on, and their sites.
  async getUser(id: string): Promise<{ user: UserDocument; sessions: SessionDocument[]; sites: SiteDocument[] }> {
    const user = await findTarget(id);
    const [sessions, sites] = await Promise.all([
      Session.find({ userId: user._id, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }),
      Site.find({ ownerId: user._id, status: { $ne: 'deleted' } }).sort({ createdAt: 1 }),
    ]);
    return { user, sessions, sites };
  },

  // Makes a user an admin or a super admin.
  async changeRole(actor: UserDocument, id: string, role: Role): Promise<UserDocument> {
    const target = await findTarget(id);
    assertCanManage(actor, target, 'change the role of');
    if (target.role !== role) {
      target.role = role;
      await target.save();
    }
    return target;
  },

  // Blocked: cannot log in or refresh, and every current login ends now.
  async blockUser(actor: UserDocument, id: string, reason: string | undefined): Promise<UserDocument> {
    const target = await findTarget(id);
    assertCanManage(actor, target, 'block');
    target.isBlocked = true;
    target.blockedAt = new Date();
    target.blockedReason = reason ?? null;
    await target.save();
    await sessionService.revokeAll(target._id, 'blocked');
    return target;
  },

  // The user can log in again.
  async unblockUser(actor: UserDocument, id: string): Promise<UserDocument> {
    const target = await findTarget(id);
    assertCanManage(actor, target, 'unblock');
    target.isBlocked = false;
    target.blockedAt = null;
    target.blockedReason = null;
    await target.save();
    return target;
  },

  // Deletes the account with its sessions and one-time tokens. Cannot be undone.
  async deleteUser(actor: UserDocument, id: string): Promise<void> {
    const target = await findTarget(id);
    assertCanManage(actor, target, 'delete');
    // Everything goes: logins, tokens, reports, activity, sites and (in the background) their collected data.
    await accountService.deleteAccount(target, true);
  },
};
