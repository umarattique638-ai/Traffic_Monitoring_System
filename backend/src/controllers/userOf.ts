import type { Request } from 'express';
import type { UserDocument } from '../models/user.model.js';
import { AppError } from '../utils/AppError.js';

// Routes behind requireAuth + attachUser: req.user is the signed-in user.
export function userOf(req: Request): UserDocument {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}
