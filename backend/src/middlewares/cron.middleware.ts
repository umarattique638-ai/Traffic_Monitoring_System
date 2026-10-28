import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { safeEqual } from '../utils/crypto.js';
import { AppError } from '../utils/AppError.js';

/**
 * The scheduled jobs (/api/v1/internal/*). Vercel Cron sends CRON_SECRET as "Authorization: Bearer <secret>".
 * Without CRON_SECRET the routes do not exist (404), so nobody can trigger them.
 */
export function requireCron(req: Request, _res: Response, next: NextFunction): void {
  if (!env.cronSecret) throw AppError.notFound();
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !safeEqual(token, env.cronSecret)) throw AppError.unauthorized('Wrong or missing cron secret.', 'cron_unauthorized');
  next();
}
