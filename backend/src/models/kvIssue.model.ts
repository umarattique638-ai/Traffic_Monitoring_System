import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

/**
 * A site whose Cloudflare KV entries may not match MongoDB yet (a KV write failed). One per site: the
 * reconciler re-syncs the site from MongoDB and removes it. The dashboard shows it until it is gone.
 */
export interface IKvIssue {
  _id: number; // the site id
  ownerId: Types.ObjectId;
  error: string;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

const kvIssueSchema = new Schema<IKvIssue>(
  {
    _id: { type: Number, required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    error: { type: String, required: true },
    attempts: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const KvIssue = model<IKvIssue>('KvIssue', kvIssueSchema);
