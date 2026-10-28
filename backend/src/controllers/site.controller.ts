import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { toHealthDTO, toKvIssueDTO, toSiteDTO } from '../dtos/site.dto.js';
import type { SiteDocument } from '../models/site.model.js';
import { keyService } from '../services/key.service.js';
import { siteService } from '../services/site.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { snippetsFor } from '../utils/snippets.js';
import {
  allowHostSchema,
  changeDomainSchema,
  deleteSiteSchema,
  keyIdSchema,
  previewSchema,
  siteIdSchema,
  sitePatchSchema,
} from '../validators/site.validator.js';
import { userOf } from './userOf.js';

/** The site of `:id`, if it belongs to the signed-in user (404 otherwise). */
export async function siteOf(req: Request): Promise<SiteDocument> {
  const { id } = siteIdSchema.parse(req.params);
  return siteService.load(userOf(req), id);
}

// The account's sites: list, change, delete, health, domain, keys. Adding a site is the setup controller.
export const siteController = {
  // GET /api/v1/sites
  async list(req: Request, res: Response): Promise<void> {
    const out = await siteService.list(userOf(req));
    ApiResponse.ok(res, {
      sites: out.sites.map(({ site, health }) => ({ ...toSiteDTO(site), health: toHealthDTO(site, health).status })),
      kvIssues: out.issues.map(({ issue, site }) => toKvIssueDTO(issue, site)),
    });
  },

  // GET /api/v1/sites/preview?domain=   What adding this domain would register.
  async preview(req: Request, res: Response): Promise<void> {
    const { domain } = previewSchema.parse(req.query);
    ApiResponse.ok(res, siteService.preview(domain));
  },

  // POST /api/v1/sites/sync-all   "Retry now" on the dashboard's Cloudflare warning.
  async syncAll(req: Request, res: Response): Promise<void> {
    const issues = await siteService.syncAll(userOf(req));
    ApiResponse.ok(res, { kvIssues: issues.map(({ issue, site }) => toKvIssueDTO(issue, site)) });
  },

  // GET /api/v1/sites/:id   The site and its snippets.
  async get(req: Request, res: Response): Promise<void> {
    const site = await siteOf(req);
    const dto = toSiteDTO(site);
    ApiResponse.ok(res, { site: dto, snippets: dto.publicKey ? snippetsFor(env.collectorUrl, dto.publicKey) : [] });
  },

  // PATCH /api/v1/sites/:id   { timezone?, status?, retentionDays? }
  async update(req: Request, res: Response): Promise<void> {
    const site = await siteOf(req);
    const input = sitePatchSchema.parse(req.body);
    const out = await siteService.update(userOf(req), site, input);
    ApiResponse.ok(res, { site: toSiteDTO(out.site), sync: out.sync }, 'Site saved.');
  },

  // DELETE /api/v1/sites/:id   { eraseData? }  Keep the data (default) or erase it for good.
  async remove(req: Request, res: Response): Promise<void> {
    const site = await siteOf(req);
    const { eraseData } = deleteSiteSchema.parse(req.body);
    const out = await siteService.remove({ user: userOf(req) }, site, eraseData);
    ApiResponse.ok(res, out, eraseData ? 'Site and its data deleted.' : 'Site deleted.');
  },

  // POST /api/v1/sites/:id/sync   Write the site to Cloudflare KV again.
  async sync(req: Request, res: Response): Promise<void> {
    const site = await siteOf(req);
    ApiResponse.ok(res, { sync: await siteService.sync(site) });
  },

  // GET /api/v1/sites/:id/health   Is it still sending data?
  async health(req: Request, res: Response): Promise<void> {
    const site = await siteOf(req);
    ApiResponse.ok(res, { health: toHealthDTO(site, await siteService.health(userOf(req), site)) });
  },

  // POST /api/v1/sites/:id/health/check   "Check again" on the banner.
  async checkHealth(req: Request, res: Response): Promise<void> {
    const site = await siteOf(req);
    ApiResponse.ok(res, { health: toHealthDTO(site, await siteService.checkHealth(userOf(req), site)) });
  },

  // POST /api/v1/sites/:id/domain   { domain }  The site moved: only if the new domain passes the install check.
  async changeDomain(req: Request, res: Response): Promise<void> {
    const site = await siteOf(req);
    const { domain } = changeDomainSchema.parse(req.body);
    const out = await siteService.changeDomain(userOf(req), site, domain);
    ApiResponse.ok(res, { ...out.result, site: out.site ? toSiteDTO(out.site) : null }, out.site ? 'Domain changed.' : 'A check failed on the new domain.');
  },

  // POST /api/v1/sites/:id/allowed-hosts   { host }  (API only)
  async allowHost(req: Request, res: Response): Promise<void> {
    const site = await siteOf(req);
    const { host } = allowHostSchema.parse(req.body);
    const out = await siteService.allowHost(userOf(req), site, host);
    ApiResponse.ok(res, { site: toSiteDTO(out.site), sync: out.sync }, 'Host allowed.');
  },

  // POST /api/v1/sites/:id/keys   Rotation step 1: a new key (both work until the old one is revoked).
  async createKey(req: Request, res: Response): Promise<void> {
    const site = await siteOf(req);
    const updated = await keyService.create(userOf(req), site);
    ApiResponse.created(res, { site: toSiteDTO(updated), sync: { ok: true } }, 'New key added. Put the new snippet on your site, then revoke the old key.');
  },

  // POST /api/v1/sites/:id/keys/:keyId/revoke   Rotation step 2.
  async revokeKey(req: Request, res: Response): Promise<void> {
    const site = await siteOf(req);
    const { keyId } = keyIdSchema.parse(req.params);
    const out = await keyService.revoke(userOf(req), site, keyId);
    ApiResponse.ok(res, { site: toSiteDTO(out.site), sync: out.sync }, 'Key revoked.');
  },
};
