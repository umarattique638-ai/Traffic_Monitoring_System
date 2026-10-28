import type { Types } from 'mongoose';
import { AUDIT_KEEP_DAYS } from '../config/tailwatch.constants.js';
import { Audit } from '../models/audit.model.js';
import type { AuditAction, AuditDocument } from '../models/audit.model.js';
import type { UserDocument } from '../models/user.model.js';
import { errorText } from '../utils/text.js';

export interface AuditQuery {
  limit: number;
  siteId: number | null;
  // Cursor: entries older than this one.
  before: { at: Date; id: Types.ObjectId } | null;
}

/**
 * The activity log. A line is written after the change succeeded; failing to write it is logged and never
 * undoes or fails the change itself (the customer's action matters more than its log line).
 */
export const auditService = {
  /** Any actor; `actor = null` is TailWatch itself (the scheduled jobs). */
  async write(ownerId: Types.ObjectId, actor: UserDocument | null, action: AuditAction, siteId: number | null, summary: string): Promise<void> {
    const at = new Date();
    try {
      await Audit.create({
        ownerId,
        at,
        actorKind: actor ? 'user' : 'system',
        actorId: actor?._id ?? null,
        actorName: (actor ? actor.name || actor.email : 'TailWatch').slice(0, 120),
        action,
        siteId,
        summary: summary.slice(0, 300),
        expiresAt: new Date(at.getTime() + AUDIT_KEEP_DAYS * 86_400_000),
      });
    } catch (error) {
      console.error(JSON.stringify({ tw: 'audit_failed', action, message: errorText(error) }));
    }
  },

  /** The signed-in user did something (to a site, or to the account when site is null). */
  record(user: UserDocument, action: AuditAction, site: { _id: number } | null, summary: string): Promise<void> {
    return this.write(user._id, user, action, site?._id ?? null, summary);
  },

  /** One page of the account's log, newest first, and whether more follow. */
  async list(ownerId: Types.ObjectId, q: AuditQuery): Promise<{ page: AuditDocument[]; more: boolean }> {
    const filter: Record<string, unknown> = { ownerId };
    if (q.siteId !== null) filter.siteId = q.siteId;
    if (q.before) filter.$or = [{ at: { $lt: q.before.at } }, { at: q.before.at, _id: { $lt: q.before.id } }];
    const entries = await Audit.find(filter).sort({ at: -1, _id: -1 }).limit(q.limit + 1);
    return { page: entries.slice(0, q.limit), more: entries.length > q.limit };
  },
};
