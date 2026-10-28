import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { REPORT_MAX, RETENTION_CHOICES } from '../config/tailwatch.constants.js';
import { emailTemplates } from '../emails/templates.js';
import { Audit } from '../models/audit.model.js';
import type { AuditDocument } from '../models/audit.model.js';
import { KvIssue } from '../models/kvIssue.model.js';
import { Report } from '../models/report.model.js';
import { SiteHealth } from '../models/siteHealth.model.js';
import { Token } from '../models/token.model.js';
import { User } from '../models/user.model.js';
import type { UserDocument } from '../models/user.model.js';
import { addDays, localDate } from '../repositories/stats.range.js';
import type { SiteExport } from '../types/stats.types.js';
import { AppError } from '../utils/AppError.js';
import { limits } from '../utils/limiter.js';
import { count, errorText } from '../utils/text.js';
import { auditService } from './audit.service.js';
import { ERASURE_SETTLE_DAYS, erasureService } from './erasure.service.js';
import { mailService } from './mail.service.js';
import { sessionService } from './session.service.js';
import { siteService } from './site.service.js';
import { statsService } from './stats.service.js';

/** Sites read from ClickHouse at once (5 queries each) in the export: quick, but gentle on ClickHouse. */
const SITES_PER_BATCH = 3;
/** A hosted function stops at 30 s: a very large account gets a clear answer instead of a cut-off file. */
const EXPORT_BUDGET_MS = 22_000;
const ACTIVITY_MAX = 5_000;

/** The signed-in user's account: profile, "download all data", delete everything. */
export const accountService = {
  /** Retention choices of this server (the Settings page shows them). */
  retention: () => ({ choices: RETENTION_CHOICES.filter((d) => d <= env.retentionDays), max: env.retentionDays, default: env.retentionDays }),

  /**
   * "Download your data": the account, every site (deleted ones too, their data is still stored), each site's
   * analytics over its whole stored history, the list of saved reports and the activity log. Never the
   * identity secrets.
   */
  async exportAll(user: UserDocument): Promise<{ json: string; filename: string }> {
    const at = new Date();
    const sites = await siteService.allOf(user._id);
    const analytics: (SiteExport | null)[] = [];
    const deadline = Date.now() + EXPORT_BUDGET_MS;
    for (let i = 0; i < sites.length; i += SITES_PER_BATCH) {
      if (Date.now() > deadline) throw new AppError(503, 'export_too_large', 'Your account has too much data to download at once. Write to us and we send you the file.');
      analytics.push(
        ...(await Promise.all(
          sites.slice(i, i + SITES_PER_BATCH).map((site) => {
            if (!statsService.configured) return Promise.resolve(null);
            const to = localDate(at, site.timezone);
            return statsService.reading(() => statsService.reader().exportSite(site._id, site.timezone, addDays(to, -site.retentionDays), to));
          }),
        )),
      );
    }
    const reports = await Promise.all(sites.map((site) => Report.find({ ownerId: user._id, siteId: site._id }).sort({ createdAt: -1 }).limit(REPORT_MAX)));
    const activity: AuditDocument[] = await Audit.find({ ownerId: user._id }).sort({ at: -1, _id: -1 }).limit(ACTIVITY_MAX);

    const data = {
      format: 'tailwatch-export/1',
      exportedAt: at.toISOString(),
      notes: [
        "Days are local calendar days in each site's timezone. Visitors per day are exact; visitorsEstimated on pages is an estimate. Pages: the 1,000 most viewed per site.",
        'No IP address and no cookie id is stored: visitors are a hash that changes every day, so nothing identifies a person.',
        statsService.configured ? "analytics covers each site's whole stored history (its retention)." : 'analytics is null: the analytics database is not configured on this server.',
      ],
      user: { name: user.name, email: user.email, createdAt: user.createdAt.toISOString() },
      sites: sites.map((site, i) => ({
        id: site._id,
        domain: site.domain,
        status: site.status,
        timezone: site.timezone,
        retentionDays: site.retentionDays,
        allowedHosts: site.allowedHosts,
        createdAt: site.createdAt.toISOString(),
        verifiedAt: site.verifiedAt?.toISOString() ?? null,
        keys: site.keys.map((k) => ({ publicKey: k.publicKey, status: k.status, createdAt: k.createdAt.toISOString(), revokedAt: k.revokedAt?.toISOString() ?? null })),
        analytics: analytics[i] ?? null,
        reports: reports[i]!.map((r) => ({ filename: r.filename, range: r.range, from: r.from, to: r.to, rows: r.rows, createdAt: r.createdAt.toISOString() })),
      })),
      activity: activity.map((e) => ({ at: e.at.toISOString(), who: e.actorName, action: e.action, siteId: e.siteId, summary: e.summary })),
    };
    await auditService.record(user, 'account.exported', null, `Downloaded all account data (${count(sites.length, 'site')})`);
    return { json: JSON.stringify(data), filename: `traffic-monitoring-export-${localDate(at, 'UTC')}.json` };
  },

  /**
   * Deletes an account (by its owner, or by a super admin): the user, logins, one-time tokens, reports, the
   * activity log and the sites go from MongoDB at once; an erasure record removes the Cloudflare KV keys and
   * the ClickHouse rows (first step now, the scheduled job finishes and verifies).
   */
  async deleteAccount(user: UserDocument, byTeam: boolean) {
    const owner = { email: user.email, name: user.name ?? null };
    await sessionService.revokeAll(user._id, 'deleted');
    const erasure = await erasureService.eraseAccount(user._id, owner);
    await Promise.all([
      Token.deleteMany({ userId: user._id }),
      Report.deleteMany({ ownerId: user._id }),
      Audit.deleteMany({ ownerId: user._id }),
      KvIssue.deleteMany({ ownerId: user._id }),
      SiteHealth.deleteMany({ ownerId: user._id }),
    ]);
    await User.deleteOne({ _id: user._id });
    console.log(JSON.stringify({ tw: 'account_deleted', sites: erasure.siteIds.length, ...(byTeam ? { by: 'super_admin' } : {}) }));

    await mailService.send(owner.email, emailTemplates.accountDeleted(owner.name, erasure.siteIds.length, ERASURE_SETTLE_DAYS, byTeam)).catch((error: unknown) => {
      console.error(JSON.stringify({ tw: 'mail_failed', kind: 'account_deleted', message: errorText(error) }));
    });
    return {
      sites: erasure.siteIds.length,
      trackingStopped: !!erasure.kvDoneAt,
      dataDeleteSent: !!erasure.dataDeleteSentAt || (erasure.rowsFound !== null && Object.values(erasure.rowsFound).every((n) => n === 0)),
      finishesWithinDays: ERASURE_SETTLE_DAYS + 1,
    };
  },

  /** "Delete account" in Settings: the password again, then everything goes. */
  async remove(userId: string, password: string) {
    if (!limits.deleteAccount.take(`u:${userId}`)) throw AppError.tooManyRequests('Too many attempts. Wait 15 minutes and try again.', 'rate_limited');
    const user = await User.findById(userId).select('+password');
    if (!user) throw AppError.unauthorized();
    if (!(await bcrypt.compare(password, user.password))) throw AppError.unauthorized('Wrong password.', 'invalid_password');
    if (env.superAdminEmails.includes(user.email)) {
      throw AppError.conflict('This account is set as a super admin in the server settings and cannot be deleted from here.', 'protected_super_admin');
    }
    return this.deleteAccount(user, false);
  },
};
