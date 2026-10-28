import { Schema, model } from 'mongoose';
import type { HydratedDocument, Types } from 'mongoose';

export type TableCounts = { events: number; sessions: number; dropped_hits: number; rollup_15m_pages: number };

/**
 * Deleting collected data in progress (a site deleted with its data, or a deleted account). MongoDB is
 * changed at once; this record drives what is left: the Cloudflare KV keys, then the ClickHouse rows,
 * until a count proves nothing is left. The scheduled maintenance job moves it forward.
 */
export interface IErasure {
  // The account it belongs to (kept even when the account itself is gone).
  ownerId: Types.ObjectId;
  kind: 'account' | 'site';
  siteIds: number[];
  publicKeys: string[];
  // For the "erasure finished" e-mail only; removed when the erasure completes.
  email: string | null;
  name: string | null;
  requestedAt: Date;
  status: 'pending' | 'completed';
  kvDoneAt: Date | null;
  dataDeleteSentAt: Date | null;
  dataVerifiedAt: Date | null;
  rowsFound: TableCounts | null;
  rowsAfterCompletion: number;
  attempts: number;
  lastError: string | null;
  completedAt: Date | null;
  updatedAt: Date;
}

export type ErasureDocument = HydratedDocument<IErasure>;

const erasureSchema = new Schema<IErasure>({
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
  kind: { type: String, enum: ['account', 'site'], required: true },
  siteIds: { type: [Number], default: [] },
  publicKeys: { type: [String], default: [] },
  email: { type: String, default: null },
  name: { type: String, default: null },
  requestedAt: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending', index: true },
  kvDoneAt: { type: Date, default: null },
  dataDeleteSentAt: { type: Date, default: null },
  dataVerifiedAt: { type: Date, default: null },
  rowsFound: { type: Object, default: null },
  rowsAfterCompletion: { type: Number, default: 0 },
  attempts: { type: Number, default: 0 },
  lastError: { type: String, default: null },
  completedAt: { type: Date, default: null },
  updatedAt: { type: Date, required: true },
});

export const Erasure = model<IErasure>('Erasure', erasureSchema);
