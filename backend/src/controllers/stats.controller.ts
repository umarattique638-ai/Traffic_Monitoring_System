import type { Request, Response } from 'express';
import type { RangeKey } from '../repositories/stats.range.js';
import { statsService } from '../services/stats.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { filterValuesSchema, filtersOf, rangeQuerySchema } from '../validators/stats.validator.js';
import { siteOf } from './site.controller.js';

const rangeOf = (req: Request) => rangeQuerySchema.parse(req.query).range as RangeKey;

// The numbers behind the dashboard pages. ?range=today|7d|30d (default 7d).
export const statsController = {
  // GET /api/v1/sites/:id/stats/overview?range=&page=&country=&source=&device=&browser=
  async overview(req: Request, res: Response): Promise<void> {
    const site = await siteOf(req);
    ApiResponse.ok(res, await statsService.overview(site, rangeOf(req), filtersOf(req.query)));
  },

  // GET /api/v1/sites/:id/stats/filter-values?range=&key=&q=
  async filterValues(req: Request, res: Response): Promise<void> {
    const site = await siteOf(req);
    const { range, key, q } = filterValuesSchema.parse(req.query);
    ApiResponse.ok(res, await statsService.filterValues(site, range as RangeKey, key, q));
  },

  // GET /api/v1/sites/:id/stats/live   Active now, the last 30 minutes, the latest hits.
  async live(req: Request, res: Response): Promise<void> {
    const site = await siteOf(req);
    ApiResponse.ok(res, await statsService.live(site));
  },

  // GET /api/v1/sites/:id/stats/events?range=
  async events(req: Request, res: Response): Promise<void> {
    const site = await siteOf(req);
    ApiResponse.ok(res, await statsService.events(site, rangeOf(req)));
  },

  // GET /api/v1/sites/:id/stats/drops?range=   Suspicious activity: blocked hits by reason.
  async drops(req: Request, res: Response): Promise<void> {
    const site = await siteOf(req);
    ApiResponse.ok(res, await statsService.drops(site, rangeOf(req)));
  },

  // GET /api/v1/sites/:id/export.csv?range=   Direct download (not saved).
  async csv(req: Request, res: Response): Promise<void> {
    const site = await siteOf(req);
    const out = await statsService.buildCsv(site, statsService.rangeOf(site, rangeOf(req)));
    res.attachment(out.filename).type('text/csv; charset=utf-8').send(out.csv);
  },
};
