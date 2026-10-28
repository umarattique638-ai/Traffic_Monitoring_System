import type { NextFunction, Request, Response } from 'express';
import { authService } from '../services/auth.service.js';
import { AppError } from '../utils/AppError.js';

/**
 * Use after requireAuth. Lets only super admins through, and puts them on req.user.
 * It reads the role from the database on every request, so a demoted or blocked super admin
 * loses access at once (not after the access token expires).
 */
export async function requireSuperAdmin(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.auth) throw AppError.unauthorized();
  const user = await authService.getActiveUser(req.auth.userId);
  if (!user) throw AppError.unauthorized();
  if (user.role !== 'super_admin')
    throw AppError.forbidden('Only a super admin can do this.', 'super_admin_only');
  req.user = user;
  next();
}
