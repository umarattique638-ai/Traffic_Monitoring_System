import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { REPORT_KEEP_DAYS, REPORT_MAX } from '../config/tailwatch.constants.js';
import { toReportDTO } from '../dtos/report.dto.js';
import type { RangeKey } from '../repositories/stats.range.js';
import { reportService } from '../services/report.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { reportIdSchema } from '../validators/site.validator.js';
import { reportBodySchema } from '../validators/stats.validator.js';
import { siteOf } from './site.controller.js';
import { userOf } from './userOf.js';

const reportIdOf = (req: Request) => new Types.ObjectId(reportIdSchema.parse(req.params).reportId);

// Reports: saved CSV exports of a site, kept REPORT_KEEP_DAYS days.
export const reportController = {
  // GET /api/v1/sites/:id/exports
  async list(req: Request, res: Response): Promise<void> {
    const site = await siteOf(req);
    const reports = await reportService.list(site);
    ApiResponse.ok(res, { keepDays: REPORT_KEEP_DAYS, max: REPORT_MAX, exports: reports.map(toReportDTO) });
  },

  // POST /api/v1/sites/:id/exports   { range }
  async create(req: Request, res: Response): Promise<void> {
    const site = await siteOf(req);
    const { range } = reportBodySchema.parse(req.body);
    const report = await reportService.create(userOf(req), site, range as RangeKey);
    ApiResponse.created(res, { export: toReportDTO(report) }, 'Report made.');
  },

  // GET /api/v1/sites/:id/exports/:reportId/download
  async download(req: Request, res: Response): Promise<void> {
    const site = await siteOf(req);
    const report = await reportService.download(site, reportIdOf(req));
    res.attachment(report.filename).type('text/csv; charset=utf-8').send(report.csv);
  },

  // DELETE /api/v1/sites/:id/exports/:reportId
  async remove(req: Request, res: Response): Promise<void> {
    const site = await siteOf(req);
    await reportService.remove(userOf(req), site, reportIdOf(req));
    ApiResponse.ok(res, null, 'Report deleted.');
  },
};
