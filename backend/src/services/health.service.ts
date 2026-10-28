import { env } from '../config/env.js';
import { emailTemplates } from '../emails/templates.js';
import { Site } from '../models/site.model.js';
import type { SiteDocument } from '../models/site.model.js';
import { SiteHealth } from '../models/siteHealth.model.js';
import type { ISiteHealth } from '../models/siteHealth.model.js';
import { User } from '../models/user.model.js';
import { analyticsRepository } from '../repositories/analytics.repository.js';
import type { SiteActivity, WrongHost } from '../repositories/analytics.repository.js';
import type { EmailContent } from '../emails/layout.js';
import { errorText, spanText } from '../utils/text.js';
import { auditService } from './audit.service.js';
import { mailService } from './mail.service.js';
import { verifierService } from './verifier.service.js';

/**
 * Is each site still sending data?
 *
 * A site is "silent" when no event arrived for longer than its usual longest pause:
 *   threshold = 2 x the longest gap between events over the last 7 days, kept between 6 hours and 3 days;
 *   a site verified less than 2 days ago: 24 hours (no habit to learn from yet).
 * A silent site is opened and the install check runs (the same 7 steps as setup):
 *   a step fails      -> broken: red banner, one e-mail to the owner, an activity line
 *   every step passes -> quiet:  the install is fine, there were simply no visitors (no e-mail)
 * Data again after "broken" -> healthy, an activity line, and one "sending again" e-mail if we sent one.
 * If most sites go silent at once the fault is ours (the pipeline): only the operator (OWNER_EMAIL) is told.
 *
 * Also once a day: far more page views than usual -> one "unusual traffic" e-mail (at most one a day).
 */
const HEALTH_WINDOW_DAYS = 7;
const NEW_SITE_DAYS = 2;
const NEW_SITE_SILENT_HOURS = 24;
const MIN_SILENT_HOURS = 6;
const MAX_SILENT_HOURS = 72;
// This many hits from one other host while the site is silent = the site moved there.
const MOVED_MIN_HITS = 3;
// Never "moved" to a developer's own machine.
const LOCAL_HOST = /^(localhost|.*\.localhost|.*\.local|\d{1,3}(\.\d{1,3}){3}|\[.*\])$/i;
// The dashboard re-checks a site only when the stored result is older than this.
const RECHECK_MINUTES = 60;
// "Most sites at once": more than half of them, and at least this many.
const PIPELINE_MIN_SILENT = 3;
// New install checks start only within this time, so a scheduled run stays inside a hosted function's 30 s.
const HEALTH_BUDGET_MS = 10_000;
const CHECKS_AT_ONCE = 4;
const HOUR = 3_600_000;

// Unusual traffic: the last 24 hours against the median of the 14 days before.
const SPIKE_BASELINE_DAYS = 14;
const SPIKE_FACTOR = 5;
const SPIKE_MIN_PAGEVIEWS = 100;
const SPIKE_MIN_AGE_DAYS = 7;
const SPIKE_REPEAT_HOURS = 20;

type Since = Pick<SiteDocument, 'verifiedAt' | 'createdAt'>;

/** How long a site may stay without data before we look at it, in whole hours. */
function silentHoursFor(site: Since, activity: SiteActivity | undefined, now: Date): number {
  const since = (site.verifiedAt ?? site.createdAt).getTime();
  if (now.getTime() - since < NEW_SITE_DAYS * 24 * HOUR) return NEW_SITE_SILENT_HOURS;
  const habit = Math.ceil((2 * (activity?.maxGapMinutes ?? 0)) / 60);
  return Math.min(MAX_SILENT_HOURS, Math.max(MIN_SILENT_HOURS, habit));
}

/** The last time data arrived, never earlier than the verification (a site added again starts fresh). */
export function lastSignal(site: Since, activity: SiteActivity | undefined): Date {
  const verified = site.verifiedAt ?? site.createdAt;
  return activity && activity.lastAt > verified ? activity.lastAt : verified;
}

function isSilent(site: Since, activity: SiteActivity | undefined, now: Date): boolean {
  return now.getTime() - lastSignal(site, activity).getTime() >= silentHoursFor(site, activity, now) * HOUR;
}

/** The other host the site's visits come from since it went silent, if any (most hits first). */
function movedHost(site: Since, activity: SiteActivity | undefined, wrong: WrongHost[] | undefined): WrongHost | null {
  const since = lastSignal(site, activity).getTime();
  return (wrong ?? []).find((w) => w.lastAt.getTime() > since && w.hits >= MOVED_MIN_HITS && !LOCAL_HOST.test(w.host)) ?? null;
}

/** Middle value (the average of the two middle ones for an even count); 0 for none. */
function median(values: number[]): number {
  if (!values.length) return 0;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid]! : (v[mid - 1]! + v[mid]!) / 2;
}

/** `days[0]` = the last 24 hours, `days[1..]` = the windows before it. Null: nothing unusual. */
function spikeOf(days: number[]): { pageviews: number; usual: number; times: number } | null {
  const last = days[0] ?? 0;
  const usual = median(days.slice(1, SPIKE_BASELINE_DAYS + 1));
  if (last < SPIKE_MIN_PAGEVIEWS || last < SPIKE_FACTOR * Math.max(usual, 1)) return null;
  return { pageviews: last, usual, times: usual > 0 ? last / usual : Infinity };
}

const dashboardLink = (site: SiteDocument) => `${env.clientUrl.split(',')[0]!.trim()}/dashboard?site=${site._id}`;

/** E-mails the site's owner (verified, not blocked). False when nothing went out. */
async function mailOwner(site: SiteDocument, make: (name: string | null) => EmailContent): Promise<boolean> {
  const owner = await User.findById(site.ownerId);
  if (!owner || owner.isBlocked || !owner.isEmailVerified) return false;
  try {
    await mailService.send(owner.email, make(owner.name ?? null));
    return true;
  } catch (error) {
    console.error(JSON.stringify({ tw: 'health_mail_failed', site: site._id, message: errorText(error) }));
    return false;
  }
}

/** Works out the site's state now, saves it, and does what a change calls for (activity line, e-mail). */
async function evaluate(site: SiteDocument, activity: SiteActivity | undefined, wrong: WrongHost[] | undefined, prevRaw: ISiteHealth | null, mayAlert: boolean): Promise<ISiteHealth> {
  const at = new Date();
  const prev = healthService.current(site, prevRaw);
  const silentHours = silentHoursFor(site, activity, at);
  let status: ISiteHealth['status'] = 'healthy';
  let reason: string | null = null;
  let failedCheck: string | null = null;
  let movedTo: string | null = null;

  if (isSilent(site, activity, at)) {
    // Visits still come, but from another website (the site moved): no need to open it.
    const moved = movedHost(site, activity, wrong);
    if (moved) {
      status = 'broken';
      failedCheck = 'moved';
      movedTo = moved.host;
      reason = `Visits now come from ${moved.host} (${moved.hits.toLocaleString('en-US')} hits since ${site.domain} went quiet), which is not this site's domain.`;
    } else {
      const result = await verifierService.runActiveCheck(site);
      const failed = result.checks.find((c) => c.status === 'fail');
      if (result.ok || !failed) status = 'quiet';
      else {
        status = 'broken';
        failedCheck = result.movedTo ? 'moved' : failed.id;
        movedTo = result.movedTo ?? null;
        reason = (result.movedTo ? failed.message : `${failed.label}: ${failed.message}`).slice(0, 500);
      }
    }
  }

  const next: ISiteHealth = {
    _id: site._id,
    ownerId: site.ownerId,
    status,
    reason,
    failedCheck,
    movedTo,
    since: prev && prev.status === status ? prev.since : at,
    checkedAt: at,
    lastEventAt: activity?.lastAt ?? prev?.lastEventAt ?? null,
    silentHours,
    alertedAt: prev?.alertedAt ?? null,
    spikeAlertedAt: prevRaw?.spikeAlertedAt ?? null,
  };

  const silence = spanText(at.getTime() - lastSignal(site, activity).getTime());
  if (status === 'broken' && prev?.status !== 'broken') {
    await auditService.write(site.ownerId, null, 'site.stopped_sending', site._id, `${site.domain} stopped sending data (nothing for ${silence}). ${reason}`.slice(0, 500));
  }
  if (prev?.status === 'broken' && status !== 'broken') {
    await auditService.write(site.ownerId, null, 'site.sending_again', site._id, status === 'healthy' ? `${site.domain} is sending data again` : `The install check of ${site.domain} passes again`);
  }
  // "Sending again" only once data really arrives (an install fixed but still without visitors waits).
  if (status === 'healthy' && next.alertedAt) {
    await mailOwner(site, (name) => emailTemplates.siteRecovered(name, site.domain, dashboardLink(site)));
    next.alertedAt = null;
  }
  if (status === 'broken' && !next.alertedAt && mayAlert) {
    if (await mailOwner(site, (name) => emailTemplates.siteBroken(name, site.domain, silence, reason!, dashboardLink(site)))) next.alertedAt = at;
  }
  await SiteHealth.replaceOne({ _id: site._id }, next, { upsert: true });
  return next;
}

/** Other hosts the sites' keys were used on; a failure only means "moved" cannot be told apart. */
async function wrongHostsOf(ids: number[]): Promise<Map<number, WrongHost[]>> {
  if (!analyticsRepository || !ids.length) return new Map();
  try {
    return await analyticsRepository.wrongHosts(ids, HEALTH_WINDOW_DAYS);
  } catch (error) {
    console.error(JSON.stringify({ tw: 'health_wrong_hosts_failed', message: errorText(error) }));
    return new Map();
  }
}

/** Unusual traffic: one e-mail (at most one a day) and an activity line. `prevOf` keeps the new date. */
async function spikeAlerts(sites: SiteDocument[], prevOf: Map<number, ISiteHealth>): Promise<number> {
  if (!analyticsRepository) return 0;
  const at = new Date();
  const old = sites.filter((x) => at.getTime() - (x.verifiedAt ?? x.createdAt).getTime() >= SPIKE_MIN_AGE_DAYS * 86_400_000);
  if (!old.length) return 0;
  let sent = 0;
  try {
    const days = await analyticsRepository.dailyPageviews(
      old.map((x) => x._id),
      SPIKE_BASELINE_DAYS + 1,
    );
    const due = old
      .map((site) => ({ site, spike: spikeOf(days.get(site._id) ?? []), saved: prevOf.get(site._id) }))
      .filter((x) => x.spike && x.saved && (!x.saved.spikeAlertedAt || at.getTime() - x.saved.spikeAlertedAt.getTime() >= SPIKE_REPEAT_HOURS * HOUR));
    if (!due.length) return 0;
    const details = await analyticsRepository.spikeDetails(due.map((x) => x.site._id));
    for (const { site, spike, saved } of due) {
      const d = details.get(site._id) ?? { pages: [], countries: [], referrers: [], blocked: 0 };
      const times = spike!.usual >= 1 ? `${Math.round(spike!.times)}x its usual ${Math.round(spike!.usual)} a day` : 'usually almost none';
      await auditService.write(site.ownerId, null, 'site.traffic_spike', site._id, `Unusual traffic on ${site.domain}: ${spike!.pageviews} page views in 24 hours (${times})`);
      await mailOwner(site, (name) => emailTemplates.siteSpike(name, site.domain, spike!, d, dashboardLink(site)));
      const next = { ...saved!, spikeAlertedAt: at };
      await SiteHealth.replaceOne({ _id: site._id }, next, { upsert: true });
      prevOf.set(site._id, next);
      sent += 1;
    }
  } catch (error) {
    console.error(JSON.stringify({ tw: 'spike_check_failed', message: errorText(error) }));
  }
  return sent;
}

const plain = (h: { toObject(): ISiteHealth } | null | undefined): ISiteHealth | null => (h ? h.toObject() : null);

export const healthService = {
  /** ClickHouse can tell when data last arrived (without it there is nothing to judge). */
  configured: !!analyticsRepository,

  /** Only these are watched: stored, verified, not paused (a paused site is silent on purpose). */
  watched: (site: SiteDocument) => site.status === 'active' && !!site.verifiedAt,

  /** A stored result from an earlier life of the site (deleted, then added again) is ignored. */
  current(site: SiteDocument, h: ISiteHealth | { toObject(): ISiteHealth } | null | undefined): ISiteHealth | null {
    const doc = h && 'toObject' in h ? h.toObject() : (h ?? null);
    return doc && site.verifiedAt && doc.checkedAt.getTime() >= site.verifiedAt.getTime() ? doc : null;
  },

  async stored(site: SiteDocument): Promise<ISiteHealth | null> {
    return this.current(site, plain(await SiteHealth.findById(site._id)));
  },

  /** Stored result is missing or older than RECHECK_MINUTES. */
  stale: (h: ISiteHealth | null) => !h || Date.now() - h.checkedAt.getTime() > RECHECK_MINUTES * 60_000,

  /** One site, for the dashboard. Never e-mails "stopped sending" (the person is looking at it). */
  async checkOne(site: SiteDocument): Promise<ISiteHealth | null> {
    if (!this.watched(site) || !analyticsRepository) return null;
    const [activity, prev] = await Promise.all([analyticsRepository.siteActivity([site._id], HEALTH_WINDOW_DAYS), SiteHealth.findById(site._id)]);
    const wrong = isSilent(site, activity.get(site._id), new Date()) ? await wrongHostsOf([site._id]) : new Map<number, WrongHost[]>();
    return evaluate(site, activity.get(site._id), wrong.get(site._id), plain(prev), false);
  },

  /** The scheduled run over every watched site. */
  async runAll() {
    const deadline = Date.now() + HEALTH_BUDGET_MS;
    const result = { configured: !!analyticsRepository, sites: 0, healthy: 0, quiet: 0, broken: 0, silent: 0, notChecked: 0, failed: 0, pipelineSuspect: false, spikes: 0 };
    if (!analyticsRepository) return result;
    const sites = (await Site.find({ status: 'active', verifiedAt: { $ne: null } })).filter((s) => this.watched(s));
    result.sites = sites.length;
    if (!sites.length) return result;
    const at = new Date();
    const activity = await analyticsRepository.siteActivity(
      sites.map((x) => x._id),
      HEALTH_WINDOW_DAYS,
    );
    const prevOf = new Map((await SiteHealth.find({ _id: { $in: sites.map((x) => x._id) } })).map((h) => [h._id, h.toObject() as ISiteHealth]));
    const silent = sites.filter((x) => isSilent(x, activity.get(x._id), at));
    result.silent = silent.length;
    result.pipelineSuspect = silent.length >= PIPELINE_MIN_SILENT && silent.length * 2 > sites.length;
    const wrong = await wrongHostsOf(silent.map((x) => x._id));

    if (result.pipelineSuspect) {
      console.error(JSON.stringify({ tw: 'health_pipeline_silent', silent: silent.length, sites: sites.length }));
      if (env.ownerEmail) {
        await mailService
          .send(env.ownerEmail, emailTemplates.pipelineSilent(silent.length, sites.length, silent.map((x) => x.domain)))
          .catch((error) => console.error(JSON.stringify({ tw: 'health_mail_failed', message: errorText(error) })));
      }
    }

    const run = async (site: SiteDocument) => {
      try {
        const h = await evaluate(site, activity.get(site._id), wrong.get(site._id), prevOf.get(site._id) ?? null, !result.pipelineSuspect);
        prevOf.set(site._id, h);
        result[h.status] += 1;
      } catch (error) {
        result.failed += 1;
        console.error(JSON.stringify({ tw: 'health_check_failed', site: site._id, message: errorText(error) }));
      }
    };

    // Sites with data first: no fetching, quick (and a recovery is never held up by the slow ones).
    const silentIds = new Set(silent.map((x) => x._id));
    for (const site of sites.filter((x) => !silentIds.has(x._id))) await run(site);
    // Unusual traffic (quick queries, before the slow install checks).
    result.spikes = await spikeAlerts(sites, prevOf);
    // Then the silent ones, a few at a time, the longest unchecked first, until the time is used up.
    const queue = [...silent].sort((a, b) => (prevOf.get(a._id)?.checkedAt.getTime() ?? 0) - (prevOf.get(b._id)?.checkedAt.getTime() ?? 0));
    const worker = async () => {
      for (let site = queue.shift(); site; site = queue.shift()) {
        if (Date.now() > deadline) {
          result.notChecked += 1;
          continue;
        }
        await run(site);
      }
    };
    await Promise.all(Array.from({ length: CHECKS_AT_ONCE }, worker));
    console.log(JSON.stringify({ tw: 'health', ...result }));
    return result;
  },
};
