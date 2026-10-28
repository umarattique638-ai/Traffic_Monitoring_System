import type { SiteDocument } from '../models/site.model.js';
import { statsRepository } from '../repositories/stats.repository.js';
import type { StatsReader } from '../repositories/stats.repository.js';
import type { FilterKey, Filters } from '../repositories/stats.queries.js';
import { resolveRange } from '../repositories/stats.range.js';
import type { Range, RangeKey } from '../repositories/stats.range.js';
import { AppError } from '../utils/AppError.js';
import { errorText } from '../utils/text.js';

/** The ClickHouse reader, or 503 when ClickHouse is not configured. */
function reader(): StatsReader {
  if (!statsRepository) throw new AppError(503, 'analytics_unavailable', 'Reports are not configured: set CLICKHOUSE_URL and CLICKHOUSE_READ_PASSWORD for the API.');
  return statsRepository;
}

/** Any ClickHouse failure becomes one clear 503 (the details go to the log). */
async function reading<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error(JSON.stringify({ tw: 'stats_failed', message: errorText(error) }));
    throw new AppError(503, 'analytics_unavailable', 'The analytics database did not answer. Try again in a moment.');
  }
}

/** A range key in the site's timezone, as of now. */
const rangeOf = (site: SiteDocument, key: RangeKey): Range => resolveRange(key, site.timezone, new Date());

/**
 * Analytics for the dashboard pages, read from ClickHouse (every number comes from a named query in
 * repositories/stats.queries.ts). Ranges are local calendar days in the site's timezone.
 */
export const statsService = {
  configured: !!statsRepository,
  reading,
  reader,
  rangeOf,

  /** The Overview page: KPIs, chart and lists, narrowed by the filters. */
  overview: (site: SiteDocument, key: RangeKey, filters: Filters) => reading(() => reader().overview(site._id, rangeOf(site, key), filters)),

  /** The Filter menu: the period's values of one filter, most used first. */
  filterValues: async (site: SiteDocument, key: RangeKey, filter: FilterKey, q: string) => ({
    values: await reading(() => reader().filterValues(site._id, rangeOf(site, key), filter, q)),
  }),

  /** Active now, the live chart and the latest hits. */
  live: (site: SiteDocument) => reading(() => reader().live(site._id, new Date())),

  /** The Events page. */
  events: (site: SiteDocument, key: RangeKey) => reading(() => reader().events(site._id, rangeOf(site, key), new Date())),

  /** Suspicious activity: blocked hits by reason. */
  drops: (site: SiteDocument, key: RangeKey) => reading(() => reader().drops(site._id, rangeOf(site, key))),

  /** The CSV of the "Visitors over time" chart: one row per local day, or per hour for Today. */
  async buildCsv(site: SiteDocument, range: Range) {
    const o = await reading(() => reader().overview(site._id, range));
    const lines = [range.hourly ? 'hour_start_utc,local_hour,visitors,sessions,pageviews' : 'date,visitors,sessions,pageviews'];
    for (const r of o.series) {
      lines.push(
        range.hourly
          ? `${new Date(Number(r.bucket) * 1000).toISOString()},${r.label},${r.visitors},${r.sessions},${r.pageviews}`
          : `${r.bucket},${r.visitors},${r.sessions},${r.pageviews}`,
      );
    }
    const safe = (v: string) => v.replace(/[^A-Za-z0-9._-]+/g, '-');
    return { csv: lines.join('\n') + '\n', rows: o.series.length, filename: `${safe(site.domain)}-${safe(range.from)}-${safe(range.to)}.csv` };
  },
};
