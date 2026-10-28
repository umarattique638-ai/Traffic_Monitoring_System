import type { Types } from 'mongoose';
import { env } from '../config/env.js';
import { MAX_ALLOWED_HOSTS, RETENTION_CHOICES } from '../config/tailwatch.constants.js';
import { KvIssue } from '../models/kvIssue.model.js';
import { Site } from '../models/site.model.js';
import type { ISite, SiteDocument, SiteKey } from '../models/site.model.js';
import { SiteHealth } from '../models/siteHealth.model.js';
import type { UserDocument } from '../models/user.model.js';
import { eraserRepository } from '../repositories/eraser.repository.js';
import { AppError } from '../utils/AppError.js';
import { allowedHostsFor } from '../utils/domain.js';
import { limits } from '../utils/limiter.js';
import { isDuplicateKeyError } from '../utils/mongoErrors.js';
import { errorText } from '../utils/text.js';
import { auditService } from './audit.service.js';
import { erasureService } from './erasure.service.js';
import { healthService } from './health.service.js';
import { kvSyncService } from './kvSync.service.js';
import { VerifyInputError, verifierService } from './verifier.service.js';

export interface SitePatchInput {
  timezone?: string;
  status?: 'active' | 'paused';
  retentionDays?: number;
}

type SiteChange = Partial<Pick<ISite, 'domain' | 'timezone' | 'status' | 'verifiedAt' | 'keys' | 'allowedHosts' | 'retentionDays'>>;

const revokeAll = (keys: SiteKey[], at: Date): SiteKey[] => keys.map((k) => ({ ...k, status: 'revoked', revokedAt: k.revokedAt ?? at }));
const plain = (site: SiteDocument) => site.toObject() as ISite;

/** Who deletes a site: the signed-in owner, or a super admin (the activity line says so). */
type By = { user: UserDocument } | { team: true };
const logDeleted = (by: By, site: SiteDocument, summary: string) =>
  'user' in by ? auditService.record(by.user, 'site.deleted', site, summary) : auditService.write(site.ownerId, null, 'site.deleted', site._id, `${summary} by a super admin`);

/**
 * An account's sites: list, change, delete, move to a new domain, health. Every stored site is verified:
 * adding one is setup.service.ts, which saves it only after every install check passed.
 */
export const siteService = {
  /** The site with this id, if it belongs to the account; 404 otherwise (never "forbidden"). */
  async load(user: UserDocument, id: number): Promise<SiteDocument> {
    const site = await Site.findOne({ _id: id, ownerId: user._id, status: { $ne: 'deleted' } });
    if (!site) throw AppError.notFound('No such site.');
    return site;
  },

  /** Saves a change, unless the site changed since it was loaded (another tab): then 409. */
  async patch(site: SiteDocument, change: SiteChange): Promise<SiteDocument> {
    const updated = await Site.findOneAndUpdate({ _id: site._id, updatedAt: site.updatedAt }, { $set: change }, { new: true });
    if (!updated) throw AppError.conflict('This site changed in another tab. Reload and try again.');
    return updated;
  },

  /** Every site of the account with its health, and the sites whose Cloudflare copy may be out of date. */
  async list(user: UserDocument) {
    const issues = await kvSyncService.issuesOf(user._id);
    const sites = await Site.find({ ownerId: user._id, status: { $ne: 'deleted' } }).sort({ createdAt: 1 });
    const stored = new Map((await SiteHealth.find({ _id: { $in: sites.map((s) => s._id) } })).map((h) => [h._id, h]));
    const all = new Map((await Site.find({ _id: { $in: issues.map((i) => i._id) } })).map((s) => [s._id, s]));
    return {
      sites: sites.map((site) => ({ site, health: healthService.current(site, stored.get(site._id)) })),
      issues: issues.map((issue) => ({ issue, site: all.get(issue._id) ?? null })),
    };
  },

  /** Is this site still sending data? The stored result, re-checked when it is older than an hour. */
  async health(user: UserDocument, site: SiteDocument) {
    let h = await healthService.stored(site);
    if (healthService.configured && healthService.watched(site) && healthService.stale(h) && limits.health.take(`u:${user._id.toHexString()}`)) {
      try {
        h = await healthService.checkOne(site);
      } catch (error) {
        console.error(JSON.stringify({ tw: 'health_check_failed', site: site._id, message: errorText(error) }));
      }
    }
    return h;
  },

  /** "Check again" on the banner: now, whatever the age of the stored result. */
  async checkHealth(user: UserDocument, site: SiteDocument) {
    if (!healthService.configured) throw new AppError(503, 'health_unavailable', 'The health check needs ClickHouse, which is not configured on the server.');
    if (!healthService.watched(site)) return healthService.stored(site);
    if (!limits.healthCheck.take(`u:${user._id.toHexString()}`)) throw AppError.tooManyRequests('Too many checks. Wait a few minutes and try again.', 'rate_limited');
    try {
      return await healthService.checkOne(site);
    } catch (error) {
      console.error(JSON.stringify({ tw: 'health_check_failed', site: site._id, message: errorText(error) }));
      throw new AppError(503, 'health_failed', 'We could not check right now. Try again in a minute.');
    }
  },

  /** "Retry now" on the dashboard's Cloudflare warning: re-sync every site of this account with an issue. */
  async syncAll(user: UserDocument) {
    await kvSyncService.reconcileIssues(user._id, 10);
    const issues = await KvIssue.find({ ownerId: user._id }).limit(50);
    const sites = new Map((await Site.find({ _id: { $in: issues.map((i) => i._id) } })).map((s) => [s._id, s]));
    return issues.map((issue) => ({ issue, site: sites.get(issue._id) ?? null }));
  },

  /** What adding this domain would register: the form shows it before submit. */
  preview: (domain: string) => ({ domain, allowedHosts: allowedHostsFor(domain) }),

  /** PATCH /sites/:id: timezone, retention, pause / resume. One activity line per thing that really changed. */
  async update(user: UserDocument, site: SiteDocument, input: SitePatchInput) {
    const change: SiteChange = {};
    if (input.timezone !== undefined) change.timezone = input.timezone;
    if (input.status !== undefined) change.status = input.status;
    if (input.retentionDays !== undefined) {
      const allowed = RETENTION_CHOICES.filter((d) => d <= env.retentionDays) as number[];
      if (!allowed.includes(input.retentionDays)) throw AppError.badRequest(`Keep data for ${allowed.join(', ')} days.`, 'invalid_retention');
      change.retentionDays = input.retentionDays;
    }

    const log = async (updated: SiteDocument) => {
      if (change.timezone && change.timezone !== site.timezone) {
        await auditService.record(user, 'site.timezone_changed', updated, `Changed the timezone of ${site.domain} from ${site.timezone} to ${change.timezone}`);
      }
      if (change.retentionDays && change.retentionDays !== site.retentionDays) {
        const shorter = change.retentionDays < site.retentionDays;
        await auditService.record(
          user,
          'site.retention_changed',
          updated,
          `Changed how long ${site.domain} keeps data from ${site.retentionDays} to ${change.retentionDays} days${shorter ? ' (older data is deleted within a week)' : ''}`,
        );
      }
      if (change.status && change.status !== site.status) {
        await auditService.record(user, change.status === 'paused' ? 'site.paused' : 'site.resumed', updated, `${change.status === 'paused' ? 'Paused' : 'Resumed'} tracking on ${site.domain}`);
      }
    };

    if (change.status === 'active' && site.status !== 'active') {
      // Resume = grant: the collector must accept the key again before the dashboard says so.
      await kvSyncService.activateFirst({ ...plain(site), ...change });
      const updated = await this.patch(site, change).catch(async (error) => {
        await kvSyncService.rollbackGrant(plain(site), []);
        throw error;
      });
      await log(updated);
      return { site: updated, sync: { ok: true } };
    }
    const updated = await this.patch(site, change);
    const sync = change.status ? await kvSyncService.sync(updated) : { ok: true };
    await log(updated);
    return { site: updated, sync };
  },

  /**
   * Delete a site. Keep its data (default): tracking stops, collected data follows the site's retention, and
   * adding the domain again brings it back. `eraseData`: the site AND everything collected for it are deleted
   * now, for good (an erasure record: KV keys go and the ClickHouse deletes are sent at once).
   */
  async remove(by: By, site: SiteDocument, eraseData: boolean) {
    if (eraseData) {
      if (!eraserRepository) {
        throw new AppError(503, 'erase_unavailable', 'Deleting collected data is not set up on the server (CLICKHOUSE_PRUNE_PASSWORD). Nothing was changed; you can still delete the site and keep its data.');
      }
      const erasure = await erasureService.eraseSites(site.ownerId, [site], null);
      await logDeleted(by, site, `Deleted ${site.domain} and all its collected data (erased for good; it cannot be brought back)`);
      return { sync: { ok: !!erasure.kvDoneAt }, erased: true };
    }
    const updated = await this.patch(site, { status: 'deleted', keys: revokeAll(site.keys, new Date()) });
    const sync = await kvSyncService.sync(updated);
    await logDeleted(by, updated, `Deleted ${site.domain} (tracking stopped; collected data is kept for ${site.retentionDays} days)`);
    return { sync, erased: false };
  },

  /** Writes the site to Cloudflare KV again, as MongoDB has it. */
  sync: (site: SiteDocument) => kvSyncService.sync(site),

  /**
   * The site moved to a new domain (shop.com -> shop.pk). The new domain must pass the install check with this
   * site's own key first; then the site keeps its id, keys and history and accepts only the new domain.
   */
  async changeDomain(user: UserDocument, site: SiteDocument, domain: string) {
    if (site.status !== 'active') throw AppError.conflict('Resume tracking first, then change the domain.', 'site_paused');
    if (domain === site.domain) throw AppError.badRequest(`${domain} is already this site's domain.`, 'same_domain');
    const other = await Site.findOne({ ownerId: user._id, domain });
    if (other && other.status !== 'deleted') throw AppError.conflict(`${domain} is already one of your sites.`, 'domain_taken');
    if (other) throw AppError.conflict(`${domain} was one of your sites before. Add it again from "Add a site" to bring its history back.`, 'domain_deleted');
    if (!limits.verify.take(`u:${user._id.toHexString()}`)) throw AppError.tooManyRequests('Too many checks. Wait a few minutes and try again.', 'rate_limited');

    if (env.checkDomainReachable) {
      const probe = await verifierService.probeDomain(domain);
      if (!probe.ok) throw AppError.badRequest(`We couldn't reach ${domain} (${probe.why}). Check the spelling; the new site must be online.`, 'domain_unreachable');
    }
    const target = { domain, allowedHosts: allowedHostsFor(domain), keys: site.keys };
    let result;
    try {
      result = await verifierService.runActiveCheck(target);
    } catch (error) {
      if (error instanceof VerifyInputError) throw AppError.badRequest(error.message, 'invalid_url');
      throw error;
    }
    if (!result.ok) return { result, site: null };

    // verifiedAt = now: the health check starts fresh for the new domain.
    const change: SiteChange = { domain, allowedHosts: allowedHostsFor(domain), verifiedAt: new Date() };
    await kvSyncService.activateFirst({ ...plain(site), ...change });
    let updated: SiteDocument;
    try {
      updated = await this.patch(site, change);
    } catch (error) {
      await kvSyncService.rollbackGrant(plain(site), []);
      if (isDuplicateKeyError(error)) throw AppError.conflict(`${domain} is already one of your sites.`, 'domain_taken');
      throw error;
    }
    await auditService.record(user, 'site.domain_changed', updated, `Changed the domain of ${site.domain} to ${domain} (its history is kept; visits from ${site.domain} no longer count)`);
    return { result, site: updated };
  },

  /** Adds a host to the site's accepted hosts (KV synced). API only. */
  async allowHost(user: UserDocument, site: SiteDocument, host: string) {
    if (site.allowedHosts.includes(host)) return { site, sync: { ok: true } };
    if (site.allowedHosts.length >= MAX_ALLOWED_HOSTS) throw AppError.conflict(`A site can accept at most ${MAX_ALLOWED_HOSTS} hosts.`, 'too_many_hosts');
    const allowedHosts = [...site.allowedHosts, host];
    await kvSyncService.activateFirst({ ...plain(site), allowedHosts });
    const updated = await this.patch(site, { allowedHosts }).catch(async (error) => {
      await kvSyncService.rollbackGrant(plain(site), []);
      throw error;
    });
    await auditService.record(user, 'host.allowed', updated, `Allowed ${host} to send data for ${site.domain}`);
    return { site: updated, sync: { ok: true } };
  },

  /** Every stored site of an account, deleted ones too (account export, erasure). */
  allOf: (ownerId: Types.ObjectId) => Site.find({ ownerId }).sort({ createdAt: 1 }),
};
