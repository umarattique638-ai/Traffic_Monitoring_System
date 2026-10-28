import { Schema, model } from 'mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import type { RangeKey } from '../repositories/stats.range.js';

/** A CSV the user made on the Reports page, kept so it can be downloaded again (deleted after 90 days). */
export interface IReport {
  ownerId: Types.ObjectId;
  siteId: number;
  range: RangeKey;
  // The local dates the report covers, as the stats range resolved them.
  from: string;
  to: string;
  timezone: string;
  filename: string;
  rows: number;
  bytes: number;
  csv: string;
  createdAt: Date;
  expiresAt: Date;
}

export type ReportDocument = HydratedDocument<IReport>;

const reportSchema = new Schema<IReport>({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  siteId: { type: Number, required: true },
  range: { type: String, enum: ['today', '7d', '30d'], required: true },
  from: { type: String, required: true },
  to: { type: String, required: true },
  timezone: { type: String, required: true },
  filename: { type: String, required: true },
  rows: { type: Number, required: true },
  bytes: { type: Number, required: true },
  csv: { type: String, required: true, select: false },
  createdAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
});

reportSchema.index({ ownerId: 1, siteId: 1, createdAt: -1 });
reportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Report = model<IReport>('Report', reportSchema);
