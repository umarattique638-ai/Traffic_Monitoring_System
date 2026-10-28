import { Types } from 'mongoose';
import { z } from 'zod';
import { ROLES } from '../models/user.model.js';

// GET /admin/users?q=umar&page=1&limit=20 (query values always arrive as text, so they are converted).
export const listUsersSchema = z.object({
  q: z.string().trim().max(100, 'Search is too long.').optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(['active', 'blocked', 'unverified']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// The :id in /admin/users/:id
export const userIdSchema = z.object({
  id: z.string().refine((v) => Types.ObjectId.isValid(v), 'Not a valid user id.'),
});

export const changeRoleSchema = z.object(
  { role: z.enum(ROLES, { error: `Role must be one of: ${ROLES.join(', ')}.` }) },
  { error: 'Send the fields as a JSON body.' },
);

// The body is optional; a reason helps later when someone asks why.
export const blockUserSchema = z
  .object({ reason: z.string().trim().max(200, 'Reason must be at most 200 characters.').optional() })
  .optional()
  .default({});

export type ListUsersQuery = z.infer<typeof listUsersSchema>;
