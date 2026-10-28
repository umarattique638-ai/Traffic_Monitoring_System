import type { Request, Response } from 'express';
import { toSetupDTO, toSiteDTO } from '../dtos/site.dto.js';
import { setupService } from '../services/setup.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { setupSchema, verifySetupSchema } from '../validators/site.validator.js';
import { userOf } from './userOf.js';

// Adding a site: start (domain + timezone -> key + snippet), verify (the install check), cancel.
export const setupController = {
  // GET /api/v1/setup   The site being set up, with its snippet, or null.
  async current(req: Request, res: Response): Promise<void> {
    const setup = await setupService.current(userOf(req));
    ApiResponse.ok(res, { setup: setup ? toSetupDTO(setup) : null });
  },

  // POST /api/v1/setup   { domain, timezone }. The same domain again continues with the same key.
  async start(req: Request, res: Response): Promise<void> {
    const input = setupSchema.parse(req.body);
    const { setup, resumed } = await setupService.start(userOf(req), input, req.ip ?? '');
    if (resumed) ApiResponse.ok(res, { setup: toSetupDTO(setup), resumed: true }, 'Continuing the setup of this domain.');
    else ApiResponse.created(res, { setup: toSetupDTO(setup), resumed: false }, 'Now paste the snippet into your site.');
  },

  // DELETE /api/v1/setup   The key stops working, nothing is left.
  async cancel(req: Request, res: Response): Promise<void> {
    await setupService.cancel(userOf(req));
    ApiResponse.ok(res, null, 'Setup cancelled.');
  },

  // POST /api/v1/setup/verify   { url? }  When every step passes, the site is created (verified).
  async verify(req: Request, res: Response): Promise<void> {
    const { url } = verifySetupSchema.parse(req.body);
    const { result, site } = await setupService.verify(userOf(req), url || undefined, req.ip ?? '');
    const message = result.ok ? 'Every check passed. Your site is added.' : 'A check failed. Fix it and check again.';
    ApiResponse.ok(res, { ...result, verifiedAt: site?.verifiedAt?.toISOString() ?? null, site: site ? toSiteDTO(site) : null }, message);
  },
};
