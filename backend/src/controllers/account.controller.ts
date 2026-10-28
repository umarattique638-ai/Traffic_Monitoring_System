import type { Request, Response } from 'express';
import { gzipSync } from 'node:zlib';
import { AUDIT_KEEP_DAYS } from '../config/tailwatch.constants.js';
import { auditCursor, toAuditDTO } from '../dtos/audit.dto.js';
import { Site } from '../models/site.model.js';
import { accountService } from '../services/account.service.js';
import { auditService } from '../services/audit.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { clearAuthCookies } from '../utils/cookie.js';
import { auditQuerySchema, deleteAccountSchema } from '../validators/account.validator.js';
import { userOf } from './userOf.js';

// The signed-in account: settings facts, activity log, download everything, delete everything.
export const accountController = {
  // GET /api/v1/account   Retention choices of this server.
  async profile(_req: Request, res: Response): Promise<void> {
    ApiResponse.ok(res, { retention: accountService.retention() });
  },

  // GET /api/v1/account/activity?limit=&site=&before=   Newest first; `before` continues from the last entry shown.
  async activity(req: Request, res: Response): Promise<void> {
    const user = userOf(req);
    const q = auditQuerySchema.parse(req.query);
    const { page, more } = await auditService.list(user._id, q);
    const domains = new Map((await Site.find({ ownerId: user._id }).select('domain')).map((s) => [s._id, s.domain]));
    ApiResponse.ok(res, {
      keepDays: AUDIT_KEEP_DAYS,
      entries: page.map((e) => toAuditDTO(e, user._id, domains)),
      next: more ? auditCursor(page[page.length - 1]!) : null,
    });
  },

  // GET /api/v1/account/export   One JSON file, gzip-compressed when the browser accepts it.
  async exportAll(req: Request, res: Response): Promise<void> {
    const { json, filename } = await accountService.exportAll(userOf(req));
    res.attachment(filename).type('application/json; charset=utf-8');
    if (/\bgzip\b/.test(req.get('accept-encoding') ?? '')) {
      res.set({ 'content-encoding': 'gzip', vary: 'accept-encoding' }).send(gzipSync(json));
      return;
    }
    res.send(json);
  },

  // POST /api/v1/account/delete   { password, confirm: "DELETE" }
  async remove(req: Request, res: Response): Promise<void> {
    const { password } = deleteAccountSchema.parse(req.body);
    const erasure = await accountService.remove(userOf(req)._id.toString(), password);
    clearAuthCookies(res);
    ApiResponse.ok(res, { erasure }, 'Your account was deleted.');
  },
};
