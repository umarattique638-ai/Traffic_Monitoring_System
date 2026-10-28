import type { Types } from 'mongoose';
import { KvIssue } from '../models/kvIssue.model.js';
import type { IKvIssue } from '../models/kvIssue.model.js';
import { Site } from '../models/site.model.js';
import type { SiteDocument } from '../models/site.model.js';
import { kvRepository } from '../repositories/kv.repository.js';
import type { KvSite } from '../repositories/kv.repository.js';
import { AppError } from '../utils/AppError.js';

export type SyncResult = { ok: true } | { ok: false; pending: true; message: string };

const log = (event: string, fields: Record<string, unknown>) => console.error(JSON.stringify({ tw: event, ...fields }));

// Dashboard loads retry an account's KV issues by themselves, at most once a minute per server instance.
const lastAutoRetry = new Map<string, number>();

/**
 * Keeping Cloudflare KV in step with MongoDB. Two directions, two rules:
 *  - GRANT (new site, new key, resume, new domain or host): KV first. If KV refuses, nothing is changed and
 *    the customer sees why (503). So a key is never shown before the collector accepts it.
 *  - REVOKE (revoke key, pause, delete): MongoDB first, then KV. A KV failure is remembered (KvIssue), shown
 *    in the dashboard, and retried until KV matches MongoDB again.
 */
export const kvSyncService = {
  /** Grant: write to KV before anything is saved; a refusal ends the request with 503. */
  async activateFirst(site: KvSite, onlyKeys?: string[]): Promise<void> {
    try {
      if (onlyKeys) await kvRepository.putKeys(site, onlyKeys);
      else await kvRepository.syncSite(site);
    } catch (error) {
      const message = kvRepository.problem(error);
      log('kv_activate_failed', { site: site._id, message });
      throw new AppError(503, 'activation_failed', `${message} Nothing was changed.`);
    }
  },

  /** Revoke (or repair): write the site as saved; a failure is remembered for the retry. */
  async sync(site: SiteDocument): Promise<SyncResult> {
    try {
      await kvRepository.syncSite(site);
      await KvIssue.deleteOne({ _id: site._id });
      return { ok: true };
    } catch (error) {
      const message = kvRepository.problem(error);
      log('kv_sync_failed', { site: site._id, message });
      await KvIssue.updateOne(
        { _id: site._id },
        { $set: { ownerId: site.ownerId, error: message }, $inc: { attempts: 1 } },
        { upsert: true },
      );
      return { ok: false, pending: true, message: `${message} Your change is saved and reaches the collector automatically once Cloudflare accepts it.` };
    }
  },

  /** A grant that went wrong after KV accepted it: take the new keys out and restore KV from MongoDB as it is NOW. */
  async rollbackGrant(site: KvSite, newKeys: string[]): Promise<void> {
    if (newKeys.length) await kvRepository.deleteKeys(newKeys);
    const fresh = await Site.findById(site._id);
    if (fresh) await this.sync(fresh);
    else await kvRepository.deleteKeys(site.keys.map((k) => k.publicKey));
  },

  /** Re-sync sites with an outstanding KV issue from MongoDB. Returns how many are fixed. */
  async reconcileIssues(ownerId: Types.ObjectId | null, limit: number): Promise<number> {
    let fixed = 0;
    const issues = await KvIssue.find(ownerId ? { ownerId } : {}).sort({ updatedAt: 1 }).limit(limit);
    for (const issue of issues) {
      const site = await Site.findById(issue._id);
      if (!site) {
        await KvIssue.deleteOne({ _id: issue._id });
        continue;
      }
      if ((await this.sync(site)).ok) fixed += 1;
    }
    return fixed;
  },

  /** The account's KV issues for the dashboard banner, after a quick automatic retry. */
  async issuesOf(ownerId: Types.ObjectId): Promise<IKvIssue[]> {
    let issues = await KvIssue.find({ ownerId }).limit(20);
    const key = ownerId.toHexString();
    if (issues.length && Date.now() - (lastAutoRetry.get(key) ?? 0) > 60_000) {
      lastAutoRetry.set(key, Date.now());
      if (lastAutoRetry.size > 10_000) lastAutoRetry.clear();
      await this.reconcileIssues(ownerId, 3);
      issues = await KvIssue.find({ ownerId }).limit(20);
    }
    return issues;
  },
};
