import type { Types } from 'mongoose';
import type { AuditDocument } from '../models/audit.model.js';

/** One activity-log entry; `me` marks the reader's own actions as "You". */
export function toAuditDTO(e: AuditDocument, me: Types.ObjectId, domains: Map<number, string>) {
  return {
    id: e._id.toString(),
    at: e.at.toISOString(),
    action: e.action,
    actor: { kind: e.actorKind, name: e.actorName, you: !!e.actorId && e.actorId.equals(me) },
    siteId: e.siteId,
    domain: e.siteId !== null ? (domains.get(e.siteId) ?? null) : null,
    summary: e.summary,
  };
}

/** Cursor of the activity log: "<ms>.<id>" of the last entry shown. */
export const auditCursor = (e: AuditDocument) => `${e.at.getTime()}.${e._id.toString()}`;
