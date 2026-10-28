import { Schema, model } from 'mongoose';
import type { HydratedDocument, Types } from 'mongoose';

/** Everything the activity log can say happened. `system` entries come from the scheduled jobs. */
export const AUDIT_ACTIONS = [
  'account.created',
  'auth.login',
  'auth.logout',
  'auth.password_reset',
  'auth.email_verified',
  'site.created',
  'site.restored',
  'site.paused',
  'site.resumed',
  'site.domain_changed',
  'site.timezone_changed',
  'site.retention_changed',
  'site.deleted',
  'site.stopped_sending',
  'site.sending_again',
  'site.traffic_spike',
  'key.created',
  'key.revoked',
  'host.allowed',
  'report.created',
  'report.deleted',
  'account.exported',
  'data.pruned',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** One line of an account's activity log: who did what, when. No IP address, no user agent. */
export interface IAudit {
  ownerId: Types.ObjectId;
  at: Date;
  actorKind: 'user' | 'system';
  actorId: Types.ObjectId | null;
  // Name at that moment, so the log stays readable if the name changes later.
  actorName: string;
  action: AuditAction;
  siteId: number | null;
  summary: string;
  expiresAt: Date;
}

export type AuditDocument = HydratedDocument<IAudit>;

const auditSchema = new Schema<IAudit>({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  at: { type: Date, required: true },
  actorKind: { type: String, enum: ['user', 'system'], required: true },
  actorId: { type: Schema.Types.ObjectId, default: null },
  actorName: { type: String, required: true, maxlength: 120 },
  action: { type: String, enum: AUDIT_ACTIONS, required: true },
  siteId: { type: Number, default: null },
  summary: { type: String, required: true, maxlength: 300 },
  expiresAt: { type: Date, required: true },
});

// Newest first per account (and per site); MongoDB deletes rows once expiresAt has passed.
auditSchema.index({ ownerId: 1, at: -1, _id: -1 });
auditSchema.index({ ownerId: 1, siteId: 1, at: -1 });
auditSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Audit = model<IAudit>('Audit', auditSchema);
