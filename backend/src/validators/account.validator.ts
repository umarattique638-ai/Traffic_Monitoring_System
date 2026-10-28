import { Types } from 'mongoose';
import { z } from 'zod';
import { DELETE_CONFIRMATION } from '../config/tailwatch.constants.js';

/** POST /account/delete { password, confirm: "DELETE" } */
export const deleteAccountSchema = z.object(
  {
    password: z.string({ error: 'Password is required.' }).min(1, 'Password is required.').max(72),
    confirm: z.literal(DELETE_CONFIRMATION, { error: `Type ${DELETE_CONFIRMATION} to confirm.` }),
  },
  { error: 'Send the fields as a JSON body.' },
);

/** GET /audit?limit=50&site=101&before=<ms>.<id> */
export const auditQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
    site: z.coerce.number().int().positive().optional(),
    before: z
      .string()
      .regex(/^\d{1,15}\.[0-9a-f]{24}$/, 'Not a valid cursor.')
      .optional(),
  })
  .transform((q) => ({
    limit: q.limit,
    siteId: q.site ?? null,
    before: q.before ? { at: new Date(Number(q.before.split('.')[0])), id: new Types.ObjectId(q.before.split('.')[1]) } : null,
  }));
