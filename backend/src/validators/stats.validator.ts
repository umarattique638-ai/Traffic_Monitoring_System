import { z } from 'zod';
import { FILTER_KEYS } from '../repositories/stats.queries.js';
import type { Filters } from '../repositories/stats.queries.js';
import { RANGE_KEYS } from '../repositories/stats.range.js';

const range = z.enum(RANGE_KEYS as [string, ...string[]], { error: `range is one of ${RANGE_KEYS.join(', ')}.` });

/** ?range=today|7d|30d (default 7d). */
export const rangeQuerySchema = z.object({ range: range.default('7d') });

/** POST /sites/:id/exports { range } */
export const reportBodySchema = z.object({ range }, { error: 'Send the fields as a JSON body.' });

/** The Filter menu: ?key=page|country|source|device|browser&q=search */
export const filterValuesSchema = z.object({
  range: range.default('7d'),
  key: z.enum(FILTER_KEYS, { error: 'Unknown filter.' }),
  q: z.string().trim().max(100).optional().default(''),
});

/** Overview filters from the query string (?page=/pricing&country=PK): plain values, length-capped. */
export function filtersOf(query: Record<string, unknown>): Filters {
  const out: Filters = {};
  for (const k of FILTER_KEYS) {
    const v = query[k];
    if (typeof v === 'string' && v.trim() && v.length <= 500) out[k] = v;
  }
  return out;
}
