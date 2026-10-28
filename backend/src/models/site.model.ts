import { Schema, model } from 'mongoose';
import type { HydratedDocument, Types } from 'mongoose';

export const SITE_STATUSES = ['active', 'paused', 'deleted'] as const;
export type SiteStatus = (typeof SITE_STATUSES)[number];
export type Region = 'in' | 'in-eu';

// A site key: "tw_pub_" + 32 letters/digits. Public by design (it sits in every page of the site).
export interface SiteKey {
  id: string;
  publicKey: string;
  status: 'active' | 'revoked';
  createdAt: Date;
  revokedAt: Date | null;
}

export interface ISite {
  // Numeric id, shared with ClickHouse (events.site_id). Allocated by the counter model.
  _id: number;
  ownerId: Types.ObjectId;
  domain: string; // "example.com": no https://, no www.
  timezone: string; // IANA, e.g. "Asia/Karachi": a site's day is its local day
  allowedHosts: string[]; // ["example.com", "*.example.com"]
  retentionDays: number;
  status: SiteStatus;
  region: Region;
  verifiedAt: Date | null;
  // Server-only HMAC secret for the daily visitor hashes. Only Cloudflare KV gets a copy; never the client.
  identitySecret: string;
  keys: SiteKey[];
  createdAt: Date;
  updatedAt: Date;
}

export type SiteDocument = HydratedDocument<ISite>;

const keySchema = new Schema<SiteKey>(
  {
    id: { type: String, required: true },
    publicKey: { type: String, required: true },
    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
    createdAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { _id: false },
);

const siteSchema = new Schema<ISite>(
  {
    _id: { type: Number, required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    domain: { type: String, required: true, lowercase: true, trim: true },
    timezone: { type: String, required: true },
    allowedHosts: { type: [String], default: [] },
    retentionDays: { type: Number, required: true },
    status: { type: String, enum: SITE_STATUSES, default: 'active', index: true },
    region: { type: String, enum: ['in', 'in-eu'], default: 'in' },
    verifiedAt: { type: Date, default: null },
    identitySecret: { type: String, required: true },
    keys: { type: [keySchema], default: [] },
  },
  { timestamps: true },
);

// One account cannot have the same domain twice (a deleted site keeps its row: adding it again restores it).
siteSchema.index({ ownerId: 1, domain: 1 }, { unique: true });
siteSchema.index({ 'keys.publicKey': 1 }, { unique: true });

export const Site = model<ISite>('Site', siteSchema);
