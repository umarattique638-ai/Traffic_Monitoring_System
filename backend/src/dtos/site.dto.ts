import { env } from '../config/env.js';
import { SETUP_TTL_DAYS } from '../config/tailwatch.constants.js';
import type { IKvIssue } from '../models/kvIssue.model.js';
import type { SiteDocument } from '../models/site.model.js';
import type { ISiteHealth } from '../models/siteHealth.model.js';
import type { Setup } from '../repositories/setup.repository.js';
import { lastSignal } from '../services/health.service.js';
import { CHECK_LABELS } from '../services/verifier.service.js';
import type { CheckId } from '../services/verifier.service.js';
import { allowedHostsFor } from '../utils/domain.js';
import { snippetsFor } from '../utils/snippets.js';

// What the API sends about sites. Never the identity secret.

export function toSiteDTO(site: SiteDocument) {
  const active = site.keys.filter((k) => k.status === 'active');
  return {
    id: site._id,
    domain: site.domain,
    timezone: site.timezone,
    allowedHosts: site.allowedHosts,
    status: site.status,
    region: site.region,
    verifiedAt: site.verifiedAt?.toISOString() ?? null,
    createdAt: site.createdAt.toISOString(),
    retentionDays: site.retentionDays,
    // The key new snippets use: the newest active one.
    publicKey: active[active.length - 1]?.publicKey ?? null,
    keys: site.keys.map((k) => ({
      id: k.id,
      publicKey: k.publicKey,
      status: k.status,
      createdAt: k.createdAt.toISOString(),
      revokedAt: k.revokedAt?.toISOString() ?? null,
    })),
  };
}

/** A site being set up, with the snippet to paste and when the setup expires. */
export function toSetupDTO(setup: Setup) {
  return {
    domain: setup.domain,
    timezone: setup.timezone,
    allowedHosts: allowedHostsFor(setup.domain),
    publicKey: setup.publicKey,
    startedAt: setup.startedAt,
    expiresAt: new Date(new Date(setup.startedAt).getTime() + SETUP_TTL_DAYS * 86_400_000).toISOString(),
    snippets: snippetsFor(env.collectorUrl, setup.publicKey),
  };
}

/** Is the site still sending data? The banner's view of the stored health. */
export function toHealthDTO(site: SiteDocument, h: ISiteHealth | null) {
  const none = { reason: null, failedCheck: null, failedLabel: null, movedTo: null, since: null, checkedAt: null, lastEventAt: null, silentForHours: null, silentHours: null };
  if (site.status === 'paused') return { status: 'paused' as const, ...none };
  if (!h) return { status: 'unknown' as const, ...none };
  const last = lastSignal(site, h.lastEventAt ? { lastAt: h.lastEventAt, maxGapMinutes: 0 } : undefined);
  return {
    status: h.status,
    reason: h.reason,
    failedCheck: h.failedCheck,
    failedLabel: h.failedCheck === 'moved' ? 'Site moved' : h.failedCheck ? (CHECK_LABELS[h.failedCheck as CheckId] ?? null) : null,
    movedTo: h.movedTo ?? null,
    since: h.since.toISOString(),
    checkedAt: h.checkedAt.toISOString(),
    lastEventAt: h.lastEventAt?.toISOString() ?? null,
    // Hours without data when it was checked ("nothing for 8 hours").
    silentForHours: Math.max(0, Math.floor((h.checkedAt.getTime() - last.getTime()) / 3_600_000)),
    silentHours: h.silentHours,
  };
}

/** A site whose Cloudflare KV copy may be out of date, as the dashboard banner shows it. */
export function toKvIssueDTO(issue: IKvIssue, site: SiteDocument | null) {
  return {
    siteId: issue._id,
    domain: site?.domain ?? String(issue._id),
    deleted: site?.status === 'deleted',
    error: issue.error,
    since: issue.createdAt.toISOString(),
    attempts: issue.attempts,
  };
}
