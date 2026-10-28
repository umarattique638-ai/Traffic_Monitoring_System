import type { Types } from 'mongoose';
import { emailTemplates } from '../emails/templates.js';
import { Erasure } from '../models/erasure.model.js';
import type { ErasureDocument, IErasure, TableCounts } from '../models/erasure.model.js';
import { Site } from '../models/site.model.js';
import type { SiteDocument } from '../models/site.model.js';
import { DATA_TABLES, eraserRepository, tablesWithRows, totalOf } from '../repositories/eraser.repository.js';
import type { AnalyticsEraser } from '../repositories/eraser.repository.js';
import { kvRepository } from '../repositories/kv.repository.js';
import { errorText } from '../utils/text.js';
import { mailService } from './mail.service.js';

/**
 * Deleting collected data for good (a site deleted with its data, or a deleted account), and retention.
 * Both are idempotent: running a step twice, or after a crash halfway, does no harm and finishes the work.
 */

/** Late events (queue retries, dead-letter replay) can still arrive: complete only after this long. */
export const ERASURE_SETTLE_DAYS = 2;
/** After completion it is still watched this long (late rows are deleted again). */
export const ERASURE_WATCH_DAYS = 30;
/** A delete that has not finished yet is sent again after this long (ClickHouse runs it in the background). */
const ERASURE_RESEND_HOURS = 6;
/** Right after the request, counting rows (for the receipt) may take this long before the deletes go out anyway. */
const COUNT_FIRST_MS = 6_000;
/** Retention runs in weekly batches: one delete a week rewrites 7x less than one a night. */
const PRUNE_SLACK_DAYS = 6;
const DAY = 86_400_000;

/** Runs `work`, but gives up waiting after `ms` (the work itself may still finish in the background). */
async function within<T>(ms: number | undefined, work: () => Promise<T>): Promise<T> {
  if (!ms) return work();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('slow to answer; the scheduled job continues')), ms);
  });
  try {
    return await Promise.race([work(), late]);
  } finally {
    clearTimeout(timer);
  }
}

const union = <T>(a: T[], b: T[]) => [...new Set([...a, ...b])];
const countsOf = (counts: Awaited<ReturnType<AnalyticsEraser['count']>>) => Object.fromEntries(DATA_TABLES.map((t) => [t, totalOf(counts, t)])) as TableCounts;

/** First instant that is kept: UTC midnight, `days` days ago. Older rows are removed. */
function retentionCutoff(now: Date, days: number): Date {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(midnight - days * DAY);
}

export const erasureService = {
  /**
   * One step forward:
   *   0. (account) sites still stored for the account (made by a request that raced the deletion) join it.
   *   1. Cloudflare KV: every key is deleted, at EVERY step (cheap; a racing request could have written one back).
   *   2. ClickHouse: rows are counted; where rows remain, the deletes are sent.
   *   3. Complete when KV is clean and a count after the settle time finds nothing; the "erasure finished"
   *      e-mail goes out and the address is removed. A completed one is watched for ERASURE_WATCH_DAYS.
   * `finish: false` never completes (right after the request); `dataBudgetMs` stops waiting for ClickHouse;
   * `deleteFirst` sends the deletes for every table at once WITHOUT counting first (right after the request).
   */
  async advance(e: ErasureDocument, options: { finish?: boolean; dataBudgetMs?: number; deleteFirst?: boolean } = {}): Promise<IErasure> {
    const now = new Date();
    const finish = options.finish ?? true;
    const patch: Partial<IErasure> = { attempts: e.attempts + 1, updatedAt: now, lastError: null };
    const errors: string[] = [];
    let siteIds = [...e.siteIds];
    let publicKeys = [...e.publicKeys];

    if (e.kind === 'account') {
      try {
        const orphans = await Site.find({ ownerId: e.ownerId });
        if (orphans.length) {
          siteIds = union(siteIds, orphans.map((s) => s._id));
          publicKeys = union(publicKeys, orphans.flatMap((s) => s.keys.map((k) => k.publicKey)));
          // Remembered BEFORE deleting them, so a crash in between loses nothing.
          await Erasure.updateOne({ _id: e._id }, { $set: { siteIds, publicKeys } });
          await Site.deleteMany({ ownerId: e.ownerId });
        }
      } catch (error) {
        errors.push(`MongoDB: ${errorText(error)}`);
      }
    }

    const kvClean = await kvRepository.deleteKeys(publicKeys);
    if (kvClean) patch.kvDoneAt = e.kvDoneAt ?? now;
    else errors.push('Cloudflare KV: some site keys could not be deleted yet (check CF_API_TOKEN).');

    let dataClean = false;
    const eraser = eraserRepository;
    if (!siteIds.length) {
      dataClean = true; // no sites: nothing in ClickHouse
      if (!e.rowsFound) patch.rowsFound = { events: 0, sessions: 0, dropped_hits: 0, rollup_15m_pages: 0 };
    } else if (!eraser) {
      errors.push('ClickHouse delete user is not configured (CLICKHOUSE_PRUNE_PASSWORD).');
    } else {
      try {
        await within(options.dataBudgetMs, async () => {
          if (options.deleteFirst) {
            const counts = await within(COUNT_FIRST_MS, () => eraser.count(siteIds, null)).catch(() => null);
            if (counts && !e.rowsFound) patch.rowsFound = countsOf(counts);
            // One retry: the first call can time out while an idle ClickHouse Cloud service wakes up.
            await eraser.remove(siteIds, null, [...DATA_TABLES]).catch(() => eraser.remove(siteIds, null, [...DATA_TABLES]));
            patch.dataDeleteSentAt = now;
            return;
          }
          const counts = await eraser.count(siteIds, null);
          const left = totalOf(counts);
          if (!e.rowsFound) patch.rowsFound = countsOf(counts);
          if (left === 0) {
            dataClean = true;
            return;
          }
          const newSites = siteIds.length !== e.siteIds.length;
          const sentLongAgo = newSites || !e.dataDeleteSentAt || now.getTime() - e.dataDeleteSentAt.getTime() >= ERASURE_RESEND_HOURS * 3_600_000;
          if (sentLongAgo) {
            await eraser.remove(siteIds, null, tablesWithRows(counts));
            patch.dataDeleteSentAt = now;
            if (e.status === 'completed') patch.rowsAfterCompletion = e.rowsAfterCompletion + left;
          }
          if (e.status === 'pending') patch.dataVerifiedAt = null;
        });
      } catch (error) {
        errors.push(`ClickHouse: ${errorText(error)}`);
      }
    }

    const settled = now.getTime() - e.requestedAt.getTime() >= ERASURE_SETTLE_DAYS * DAY;
    if (e.status === 'pending' && dataClean && settled) patch.dataVerifiedAt = e.dataVerifiedAt ?? now;

    if (finish && e.status === 'pending' && kvClean && dataClean && settled) {
      const found = patch.rowsFound ?? e.rowsFound;
      if (e.email) {
        const rows = found ? DATA_TABLES.reduce((n, t) => n + found[t], 0) : 0;
        await mailService.send(e.email, emailTemplates.erasureDone(e.name, rows, ERASURE_WATCH_DAYS)).catch((error: unknown) => {
          // Complete either way; the e-mail is a courtesy.
          console.error(JSON.stringify({ tw: 'mail_failed', kind: 'erasure_done', message: errorText(error) }));
        });
      }
      Object.assign(patch, { status: 'completed', completedAt: now, email: null, name: null });
    }
    if (errors.length) patch.lastError = errors.join(' ').slice(0, 500);
    await Erasure.updateOne({ _id: e._id }, { $set: patch });
    if (errors.length) console.error(JSON.stringify({ tw: 'erasure_step_failed', erasure: e._id.toHexString(), errors }));
    return { ...(e.toObject() as IErasure), ...patch };
  },

  /**
   * Erase sites with everything they collected (a site deleted with its data). The sites leave MongoDB now;
   * the first step (KV keys, ClickHouse deletes) runs at once, the scheduled job finishes and verifies.
   */
  async eraseSites(ownerId: Types.ObjectId, sites: SiteDocument[], owner: { email: string; name: string | null } | null): Promise<IErasure> {
    const at = new Date();
    const erasure = await Erasure.create({
      ownerId,
      kind: 'site',
      siteIds: sites.map((s) => s._id),
      publicKeys: sites.flatMap((s) => s.keys.map((k) => k.publicKey)),
      email: owner?.email ?? null,
      name: owner?.name ?? null,
      requestedAt: at,
      updatedAt: at,
    });
    await Site.deleteMany({ _id: { $in: sites.map((s) => s._id) } });
    return this.advance(erasure, { finish: false, dataBudgetMs: 20_000, deleteFirst: true }).catch((error: unknown) => {
      console.error(JSON.stringify({ tw: 'erasure_start_failed', message: errorText(error) }));
      return erasure.toObject() as IErasure;
    });
  },

  /** A deleted account: every site, and the "erasure finished" e-mail to the owner at the end. */
  async eraseAccount(ownerId: Types.ObjectId, owner: { email: string; name: string | null } | null): Promise<IErasure> {
    const at = new Date();
    const sites = await Site.find({ ownerId });
    const erasure = await Erasure.create({
      ownerId,
      kind: 'account',
      siteIds: sites.map((s) => s._id),
      publicKeys: sites.flatMap((s) => s.keys.map((k) => k.publicKey)),
      email: owner?.email ?? null,
      name: owner?.name ?? null,
      requestedAt: at,
      updatedAt: at,
    });
    await Site.deleteMany({ ownerId });
    return this.advance(erasure, { finish: false, dataBudgetMs: 20_000, deleteFirst: true }).catch((error: unknown) => {
      console.error(JSON.stringify({ tw: 'erasure_start_failed', message: errorText(error) }));
      return erasure.toObject() as IErasure;
    });
  },

  /** The scheduled run: one step forward for every erasure that is pending or still watched. */
  async advanceAll(deadline: number) {
    const result = { advanced: 0, completed: 0, failed: 0, removed: 0 };
    const watchSince = new Date(Date.now() - ERASURE_WATCH_DAYS * DAY);
    // Watched long enough: the record itself goes (it holds no personal data, but nothing needs it any more).
    try {
      result.removed = (await Erasure.deleteMany({ status: 'completed', completedAt: { $lt: watchSince } })).deletedCount;
    } catch (error) {
      console.error(JSON.stringify({ tw: 'erasure_cleanup_failed', message: errorText(error) }));
    }
    const active = await Erasure.find({ $or: [{ status: 'pending' }, { status: 'completed', completedAt: { $gte: watchSince } }] })
      .sort({ updatedAt: 1 })
      .limit(50);
    for (const e of active) {
      if (Date.now() > deadline) break;
      try {
        const next = await this.advance(e);
        result.advanced += 1;
        if (next.status === 'completed' && e.status === 'pending') result.completed += 1;
        if (next.lastError) result.failed += 1;
      } catch (error) {
        result.failed += 1;
        console.error(JSON.stringify({ tw: 'erasure_failed', erasure: e._id.toHexString(), message: errorText(error) }));
      }
    }
    return result;
  },

  /**
   * Retention: for every group of sites with the same retention, once some rows are PRUNE_SLACK_DAYS past the
   * cutoff, every row older than the cutoff is counted and deleted (only in tables that have such rows).
   */
  async pruneRetention(eraser: AnalyticsEraser, sites: SiteDocument[], deadline: number) {
    const now = new Date();
    const groups = new Map<number, SiteDocument[]>();
    for (const s of sites) {
      if (!Number.isInteger(s.retentionDays) || s.retentionDays < 1) continue;
      groups.set(s.retentionDays, [...(groups.get(s.retentionDays) ?? []), s]);
    }
    const out: { site: SiteDocument; cutoff: Date; rows: TableCounts }[] = [];
    for (const [days, list] of [...groups].sort((a, b) => a[0] - b[0])) {
      if (Date.now() > deadline) break;
      const cutoff = retentionCutoff(now, days);
      const ids = list.map((s) => s._id);
      if (totalOf(await eraser.count(ids, new Date(cutoff.getTime() - PRUNE_SLACK_DAYS * DAY))) === 0) continue;
      const counts = await eraser.count(ids, cutoff);
      const tables = tablesWithRows(counts);
      if (!tables.length) continue;
      await eraser.remove(
        list.filter((s) => DATA_TABLES.some((t) => (counts[t].get(s._id) ?? 0) > 0)).map((s) => s._id),
        cutoff,
        tables,
      );
      for (const site of list) {
        const rows = Object.fromEntries(DATA_TABLES.map((t) => [t, counts[t].get(site._id) ?? 0])) as TableCounts;
        if (DATA_TABLES.some((t) => rows[t] > 0)) out.push({ site, cutoff, rows });
      }
    }
    return out;
  },
};
