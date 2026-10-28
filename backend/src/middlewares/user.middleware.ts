import type { NextFunction, Request, Response } from 'express';
import { authService } from '../services/auth.service.js';
import { AppError } from '../utils/AppError.js';

/**
 * Use after requireAuth. Loads the signed-in user (not blocked, not deleted) onto req.user, so the site and
 * analytics controllers know whose sites they may touch and whose name goes in the activity log.
 */
export async function attachUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.auth) throw AppError.unauthorized();
  const user = await authService.getActiveUser(req.auth.userId);
  if (!user) throw AppError.unauthorized();
  req.user = user;
  next();
}
