import { Types } from 'mongoose';
import { z } from 'zod';
import { canonicalTimezone, normalizeDomain } from '../utils/domain.js';

const JSON_BODY = { error: 'Send the fields as a JSON body.' };

/** A domain as people type it ("https://www.Shop.com/") -> "shop.com". */
export const domain = z
  .string({ error: 'Domain is required.' })
  .transform((value, ctx) => {
    const d = normalizeDomain(value);
    if (!d) {
      ctx.addIssue({ code: 'custom', message: 'Enter a domain like example.com (no IP addresses or localhost).' });
      return z.NEVER;
    }
    return d;
  });

/** An IANA timezone, in its canonical spelling. */
const timezone = z
  .string({ error: 'Timezone is required.' })
  .transform((value, ctx) => {
    const tz = canonicalTimezone(value);
    if (!tz) {
      ctx.addIssue({ code: 'custom', message: 'Choose a timezone from the list.' });
      return z.NEVER;
    }
    return tz;
  });

/** The :id of /sites/:id. Anything that is not a site id is simply "no such site". */
export const siteIdSchema = z.object({ id: z.coerce.number().int().positive() });

/** The :keyId of /sites/:id/keys/:keyId/revoke. */
export const keyIdSchema = z.object({ keyId: z.string().regex(/^k_[A-Za-z0-9]{12}$/, 'No such key.') });

/** Adding a site: the domain, then the timezone. */
export const setupSchema = z.object({ domain, timezone }, JSON_BODY);

/** The install check of a site being set up; `url` is optional (default https://<domain>/). */
export const verifySetupSchema = z.object({ url: z.string().trim().max(2048).optional() }).optional().default({});

/** GET /sites/preview?domain= */
export const previewSchema = z.object({ domain });

/** PATCH /sites/:id: timezone, pause / resume, retention. */
export const sitePatchSchema = z.object(
  {
    timezone: timezone.optional(),
    status: z.enum(['active', 'paused'], { error: 'Status is active or paused.' }).optional(),
    retentionDays: z.number({ error: 'Retention is a number of days.' }).int().optional(),
  },
  JSON_BODY,
);

/** DELETE /sites/:id { eraseData } */
export const deleteSiteSchema = z.object({ eraseData: z.boolean().optional().default(false) }).optional().default({ eraseData: false });

/** POST /sites/:id/domain { domain } */
export const changeDomainSchema = z.object({ domain }, JSON_BODY);

/** POST /sites/:id/allowed-hosts { host }: "shop.example.com" or "*.example.com". */
export const allowHostSchema = z.object(
  {
    host: z
      .string({ error: 'Host is required.' })
      .trim()
      .toLowerCase()
      .transform((h) => h.replace(/\.$/, ''))
      .refine((h) => /^(?:\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(h) && h.length <= 253, 'Enter a host name like shop.example.com.'),
  },
  JSON_BODY,
);

/** The :reportId of /sites/:id/exports/:reportId. */
export const reportIdSchema = z.object({ reportId: z.string().refine((v) => Types.ObjectId.isValid(v), 'No such report.') });
