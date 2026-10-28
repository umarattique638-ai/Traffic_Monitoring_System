import { env } from '../config/env.js';
import { Counter } from '../models/counter.model.js';
import { Site } from '../models/site.model.js';
import type { SiteDocument, SiteKey } from '../models/site.model.js';
import type { UserDocument } from '../models/user.model.js';
import { setupRepository } from '../repositories/setup.repository.js';
import type { Setup } from '../repositories/setup.repository.js';
import { AppError } from '../utils/AppError.js';
import { allowedHostsFor } from '../utils/domain.js';
import { limits } from '../utils/limiter.js';
import { isDuplicateKeyError } from '../utils/mongoErrors.js';
import { newIdentitySecret, newKeyId, newPublicKey } from '../utils/siteSecrets.js';
import { auditService } from './audit.service.js';
import { kvSyncService } from './kvSync.service.js';
import { VerifyInputError, verifierService } from './verifier.service.js';
import type { ActiveResult } from './verifier.service.js';

const domainTaken = (domain: string) => new AppError(409, 'domain_taken', `${domain} is already one of your sites.`);
const noSetup = () => AppError.notFound('No site is being set up. Add your site first.', 'no_setup');

/** The install check opens other people's servers: limited per account and per client address. */
const rateLimited = (user: UserDocument, ip: string) => !limits.verify.take(`u:${user._id.toHexString()}`) || !limits.verifyIp.take(`ip:${ip}`);

/** Saving failed after the key entry was rewritten: the key goes back to "setup" (nothing is stored). */
const backToSetup = (ownerId: string, current: Setup) => setupRepository.start(ownerId, current).catch(() => undefined);

/** The next numeric site id (ClickHouse site_id), never below SITE_ID_FLOOR. */
async function nextSiteId(): Promise<number> {
  await Counter.updateOne({ _id: 'site' }, { $max: { value: env.siteIdFloor } }, { upsert: true });
  const counter = await Counter.findOneAndUpdate({ _id: 'site' }, { $inc: { value: 1 } }, { new: true });
  return counter!.value;
}

/** Every check passed: NOW the site is saved (KV first, then MongoDB). */
async function createVerified(user: UserDocument, current: Setup): Promise<SiteDocument> {
  const ownerId = user._id.toHexString();
  const at = new Date();
  const key: SiteKey = { id: newKeyId(), publicKey: current.publicKey, createdAt: at, revokedAt: null, status: 'active' };
  const existing = await Site.findOne({ ownerId: user._id, domain: current.domain });
  if (existing && existing.status !== 'deleted') throw domainTaken(current.domain);

  let site: SiteDocument;
  if (existing) {
    // A deleted domain comes back with its history (same site id), on the key just verified.
    const patch = {
      status: 'active' as const,
      timezone: current.timezone,
      allowedHosts: allowedHostsFor(existing.domain),
      identitySecret: newIdentitySecret(),
      keys: [...existing.keys.map((k) => ({ ...k, status: 'revoked' as const, revokedAt: k.revokedAt ?? at })), key],
      verifiedAt: at,
    };
    await kvSyncService.activateFirst({ ...existing.toObject(), ...patch }, [key.publicKey]);
    const updated = await Site.findOneAndUpdate({ _id: existing._id, updatedAt: existing.updatedAt }, { $set: patch }, { new: true }).catch(async (error) => {
      await backToSetup(ownerId, current);
      throw error;
    });
    if (!updated) {
      await backToSetup(ownerId, current);
      throw AppError.conflict('This site changed in another tab. Check again.');
    }
    site = updated;
    await auditService.record(user, 'site.restored', site, `Added ${site.domain} again after every install check passed (its earlier data is back)`);
  } else {
    const draft = {
      _id: await nextSiteId(),
      ownerId: user._id,
      domain: current.domain,
      timezone: current.timezone,
      allowedHosts: allowedHostsFor(current.domain),
      retentionDays: env.retentionDays,
      status: 'active' as const,
      region: env.region,
      verifiedAt: at,
      identitySecret: newIdentitySecret(),
      keys: [key],
    };
    // The collector entry turns from "setup" into the real site (id, identity secret) first.
    await kvSyncService.activateFirst(draft);
    try {
      site = await Site.create(draft);
    } catch (error) {
      await backToSetup(ownerId, current);
      if (isDuplicateKeyError(error)) throw domainTaken(current.domain);
      throw error;
    }
    await auditService.record(user, 'site.created', site, `Added ${site.domain} (timezone ${site.timezone}) after every install check passed`);
  }
  await setupRepository.finish(ownerId);
  return site;
}

/**
 * Adding a site. The site is saved in MongoDB only at the very end, when every install check passed. Before
 * that nothing is stored in our databases: the setup lives in Cloudflare KV entries that expire by themselves.
 *
 *   start    domain + timezone -> key + snippet (nothing answers at the domain: refused)
 *   current  the setup in progress
 *   verify   run the checks; all pass -> the site is created, verified
 *   cancel   the key stops working, nothing is left
 */
export const setupService = {
  /** The account's setup in progress, or null. */
  current: (user: UserDocument) => setupRepository.get(user._id.toHexString()),

  /**
   * Start adding a site. The same domain again continues with the same key (a snippet already pasted stays
   * valid); a different domain replaces the earlier setup (its key stops working).
   */
  async start(user: UserDocument, input: { domain: string; timezone: string }, ip: string): Promise<{ setup: Setup; resumed: boolean }> {
    const { domain, timezone } = input;
    const ownerId = user._id.toHexString();

    const existing = await Site.findOne({ ownerId: user._id, domain });
    if (existing && existing.status !== 'deleted') throw domainTaken(domain);

    const current = await setupRepository.get(ownerId);
    if (current?.domain === domain) {
      const next = { ...current, timezone };
      if (timezone !== current.timezone) await setupRepository.update(ownerId, next);
      return { setup: next, resumed: true };
    }

    if (rateLimited(user, ip)) throw AppError.tooManyRequests('Too many tries. Wait a few minutes and try again.', 'rate_limited');
    // A typo or an invented domain is refused here, before anything is created.
    if (env.checkDomainReachable) {
      const probe = await verifierService.probeDomain(domain);
      if (!probe.ok) {
        throw AppError.badRequest(`We couldn't reach ${domain} (${probe.why}). Check the spelling; the site must be online before you add it.`, 'domain_unreachable');
      }
    }

    if (current) await setupRepository.cancel(ownerId, current);
    const next: Setup = { domain, timezone, publicKey: newPublicKey(), startedAt: new Date().toISOString() };
    await setupRepository.start(ownerId, next);
    return { setup: next, resumed: false };
  },

  /** Cancel: the key stops working, nothing is left. */
  async cancel(user: UserDocument): Promise<void> {
    const ownerId = user._id.toHexString();
    const current = await setupRepository.get(ownerId);
    if (current) await setupRepository.cancel(ownerId, current);
  },

  /** The install check. All steps pass -> the site is written to MongoDB, verified from the start. */
  async verify(user: UserDocument, url: string | undefined, ip: string): Promise<{ result: ActiveResult; site: SiteDocument | null }> {
    const current = await setupRepository.get(user._id.toHexString());
    if (!current) throw noSetup();
    if (rateLimited(user, ip)) throw AppError.tooManyRequests('Too many checks. Wait a few minutes and try again.', 'rate_limited');
    const target = { domain: current.domain, allowedHosts: allowedHostsFor(current.domain), keys: [{ publicKey: current.publicKey, status: 'active' }] };
    let result: ActiveResult;
    try {
      result = await verifierService.runActiveCheck(target, url);
    } catch (error) {
      if (error instanceof VerifyInputError) throw AppError.badRequest(error.message, 'invalid_url');
      throw error;
    }
    const site = result.ok ? await createVerified(user, current) : null;
    return { result, site };
  },
};
