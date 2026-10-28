import { Schema, model } from 'mongoose';
import type { HydratedDocument, Types } from 'mongoose';

export const HEALTH_STATUSES = ['healthy', 'quiet', 'broken'] as const;
export type HealthStatus = (typeof HEALTH_STATUSES)[number];

/**
 * Is a site still sending data? One per site, written by the health check.
 *   healthy  data arrived recently (for this site's usual rhythm)
 *   quiet    no data for a while, but the install check passes: simply no visitors
 *   broken   no data for a while AND the install check fails (failedCheck, reason)
 */
export interface ISiteHealth {
  _id: number; // the site id
  ownerId: Types.ObjectId;
  status: HealthStatus;
  reason: string | null;
  failedCheck: string | null;
  // failedCheck "moved": the host the visits now come from.
  movedTo: string | null;
  since: Date;
  checkedAt: Date;
  lastEventAt: Date | null;
  silentHours: number;
  // When the "stopped sending data" e-mail went out (cleared by the recovery e-mail).
  alertedAt: Date | null;
  // When the last "unusual traffic" e-mail went out (at most one a day).
  spikeAlertedAt: Date | null;
}

export type SiteHealthDocument = HydratedDocument<ISiteHealth>;

const siteHealthSchema = new Schema<ISiteHealth>({
  _id: { type: Number, required: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: HEALTH_STATUSES, required: true },
  reason: { type: String, default: null },
  failedCheck: { type: String, default: null },
  movedTo: { type: String, default: null },
  since: { type: Date, required: true },
  checkedAt: { type: Date, required: true },
  lastEventAt: { type: Date, default: null },
  silentHours: { type: Number, required: true },
  alertedAt: { type: Date, default: null },
  spikeAlertedAt: { type: Date, default: null },
});

export const SiteHealth = model<ISiteHealth>('SiteHealth', siteHealthSchema);
