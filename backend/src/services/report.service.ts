import type { Types } from 'mongoose';
import { REPORT_KEEP_DAYS, REPORT_MAX } from '../config/tailwatch.constants.js';
import { Report } from '../models/report.model.js';
import type { ReportDocument } from '../models/report.model.js';
import type { SiteDocument } from '../models/site.model.js';
import type { UserDocument } from '../models/user.model.js';
import { resolveRange } from '../repositories/stats.range.js';
import type { RangeKey } from '../repositories/stats.range.js';
import { AppError } from '../utils/AppError.js';
import { auditService } from './audit.service.js';
import { statsService } from './stats.service.js';

/** Reports: saved CSV exports of a site, kept REPORT_KEEP_DAYS days, at most REPORT_MAX at a time. */
export const reportService = {
  /** The site's saved reports, newest first (without their CSV). */
  list: (site: SiteDocument) =>
    Report.find({ ownerId: site.ownerId, siteId: site._id, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .limit(REPORT_MAX),

  /** Make a report: the CSV is built now, saved, and can be downloaded again until it expires. */
  async create(user: UserDocument, site: SiteDocument, key: RangeKey): Promise<ReportDocument> {
    const at = new Date();
    if ((await Report.countDocuments({ ownerId: site.ownerId, siteId: site._id, expiresAt: { $gt: at } })) >= REPORT_MAX) {
      throw AppError.conflict(`You have ${REPORT_MAX} saved reports for this site. Delete some to make a new one.`, 'too_many_reports');
    }
    const range = resolveRange(key, site.timezone, at);
    const out = await statsService.buildCsv(site, range);
    const report = await Report.create({
      ownerId: site.ownerId,
      siteId: site._id,
      range: key,
      from: range.from,
      to: range.to,
      timezone: site.timezone,
      filename: out.filename,
      rows: out.rows,
      bytes: Buffer.byteLength(out.csv, 'utf8'),
      csv: out.csv,
      createdAt: at,
      expiresAt: new Date(at.getTime() + REPORT_KEEP_DAYS * 86_400_000),
    });
    await auditService.record(user, 'report.created', site, `Made a report of ${site.domain}: ${range.from === range.to ? range.from : `${range.from} to ${range.to}`}`);
    return report;
  },

  /** A saved report with its CSV, while it exists. */
  async download(site: SiteDocument, id: Types.ObjectId): Promise<ReportDocument> {
    const report = await Report.findOne({ _id: id, ownerId: site.ownerId, siteId: site._id, expiresAt: { $gt: new Date() } }).select('+csv');
    if (!report) throw AppError.notFound(`This report no longer exists (deleted, or older than ${REPORT_KEEP_DAYS} days).`);
    return report;
  },

  async remove(user: UserDocument, site: SiteDocument, id: Types.ObjectId): Promise<void> {
    const report = await Report.findOneAndDelete({ _id: id, ownerId: site.ownerId, siteId: site._id });
    if (!report) throw AppError.notFound('No such report.');
    await auditService.record(user, 'report.deleted', site, `Deleted the report ${report.filename}`);
  },
};
