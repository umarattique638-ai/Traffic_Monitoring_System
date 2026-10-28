import { Site } from '../models/site.model.js';
import { KvIssue } from '../models/kvIssue.model.js';
import { eraserRepository } from '../repositories/eraser.repository.js';
import { kvRepository } from '../repositories/kv.repository.js';
import { count, dayFmt, errorText } from '../utils/text.js';
import { auditService } from './audit.service.js';
import { erasureService } from './erasure.service.js';
import { healthService } from './health.service.js';
import { kvSyncService } from './kvSync.service.js';

/** A hosted function (Vercel) stops at 30 s; each job keeps well inside that. */
const MAINTENANCE_BUDGET_MS = 25_000;
const RECONCILE_BUDGET_MS = 20_000;

/** The scheduled jobs (GET /api/v1/internal/*, called by Vercel Cron with CRON_SECRET). */
export const maintenanceService = {
  /** Erasures first, then retention (off and reported when CLICKHOUSE_PRUNE_PASSWORD is not set). */
  async runMaintenance() {
    const deadline = Date.now() + MAINTENANCE_BUDGET_MS;
    const erasures = await erasureService.advanceAll(deadline);
    const retention: { configured: boolean; sitesPruned: number; rows: number; error?: string } = { configured: !!eraserRepository, sitesPruned: 0, rows: 0 };
    if (eraserRepository && Date.now() < deadline) {
      try {
        const sites = await Site.find({ status: { $ne: 'deleted' } });
        for (const p of await erasureService.pruneRetention(eraserRepository, sites, deadline)) {
          retention.sitesPruned += 1;
          const r = p.rows;
          retention.rows += r.events + r.sessions + r.dropped_hits + r.rollup_15m_pages;
          const parts = [
            r.events && count(r.events, 'event'),
            r.sessions && count(r.sessions, 'session row'),
            r.dropped_hits && count(r.dropped_hits, 'blocked-hit row'),
            r.rollup_15m_pages && count(r.rollup_15m_pages, 'page-total row'),
          ].filter(Boolean);
          await auditService.write(
            p.site.ownerId,
            null,
            'data.pruned',
            p.site._id,
            `Removed data of ${p.site.domain} older than ${p.site.retentionDays} days (before ${dayFmt.format(p.cutoff)}): ${parts.join(', ')}`,
          );
        }
      } catch (error) {
        retention.error = errorText(error).slice(0, 200);
        console.error(JSON.stringify({ tw: 'retention_failed', message: retention.error }));
      }
    }
    console.log(JSON.stringify({ tw: 'maintenance', erasures, retention }));
    return { erasures, retention };
  },

  /**
   * Makes Cloudflare KV match MongoDB for every site: first the known issues, then a full compare (read each
   * entry, write only what differs), in a random order, so that over a few days every site is checked.
   */
  async reconcileKv() {
    const deadline = Date.now() + RECONCILE_BUDGET_MS;
    const fixedIssues = await kvSyncService.reconcileIssues(null, 50);
    let checked = 0;
    let repaired = 0;
    const failed: number[] = [];
    const all = await Site.find({});
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j]!, all[i]!];
    }
    for (const loaded of all) {
      if (Date.now() > deadline) break;
      try {
        let wrong = false;
        for (const [name, want] of kvRepository.expectedEntries(loaded)) {
          checked += 1;
          if ((await kvRepository.get(name)) !== want) wrong = true;
        }
        if (!wrong) continue;
        // Re-read: a change made while we were comparing must win over our snapshot.
        const fresh = await Site.findById(loaded._id);
        if (!fresh) continue;
        if ((await kvSyncService.sync(fresh)).ok) repaired += 1;
        else failed.push(fresh._id);
      } catch (error) {
        failed.push(loaded._id);
        await KvIssue.updateOne({ _id: loaded._id }, { $set: { ownerId: loaded.ownerId, error: kvRepository.problem(error) }, $inc: { attempts: 1 } }, { upsert: true });
      }
    }
    console.log(JSON.stringify({ tw: 'kv_reconcile', fixedIssues, checked, repaired, failed: failed.length }));
    return { fixedIssues, checked, repaired, failed };
  },

  /** Is every site still sending data (and any unusual traffic)? */
  runHealth: () => healthService.runAll(),
};
