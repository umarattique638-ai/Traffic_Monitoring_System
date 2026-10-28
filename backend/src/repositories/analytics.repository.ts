import { readClient } from './clickhouse.client.js';
import type { ClickHouseClient } from './clickhouse.client.js';

/**
 * ClickHouse reads of the scheduled health check: when each site last sent data, other hosts its key
 * was used on (the site moved), and unusual traffic. Read-only user tw_read.
 */
export interface RecentActivity {
  events: number;
  pageviews: number;
  last: { at: string; name: string; path: string } | null;
  drops: { reason: string; hits: number; detail: string }[];
}

/** A site's rhythm over the last days: when data last arrived, and the longest pause between two arrivals. */
export interface SiteActivity {
  lastAt: Date;
  /** Longest gap between two minutes that had events, in minutes (0 with a single active minute). */
  maxGapMinutes: number;
}

/** Hits of a site dropped because they came from another website (dropped_hits, reason "hostname"). */
export interface WrongHost {
  host: string;
  hits: number;
  lastAt: Date;
}

/** Decision 31: what an unusual day was made of (last 24 hours, most first). */
export interface SpikeDetails {
  pages: { label: string; count: number }[];
  countries: { label: string; count: number }[];
  referrers: { label: string; count: number }[];
  /** Hits dropped in the same 24 hours (bots, wrong host, ...): a flood often shows here too. */
  blocked: number;
}

export class AnalyticsReader {
  constructor(private readonly ch: ClickHouseClient) {}

  async recent(siteId: number, minutes: number): Promise<RecentActivity> {
    const db = this.ch.database;
    const [summary] = await this.ch.query<{ events: string; pageviews: string; last_at: string; last_name: string; last_path: string }>(
      `SELECT count() AS events, countIf(name = 'pageview') AS pageviews,
              max(received_at) AS last_at, argMax(name, received_at) AS last_name, argMax(pathname, received_at) AS last_path
         FROM ${db}.events
        WHERE site_id = {site:UInt64} AND received_at >= now64(3) - toIntervalMinute({minutes:UInt32})`,
      { site: siteId, minutes },
    );
    const drops = await this.ch.query<{ reason: string; hits: string; detail: string }>(
      `SELECT reason, sum(hits) AS hits, any(detail) AS detail
         FROM ${db}.dropped_hits
        WHERE site_id = {site:UInt64} AND at >= now64(3) - toIntervalMinute({minutes:UInt32})
        GROUP BY reason ORDER BY hits DESC`,
      { site: siteId, minutes },
    );
    const events = Number(summary?.events ?? 0);
    return {
      events,
      pageviews: Number(summary?.pageviews ?? 0),
      last: events > 0 && summary ? { at: `${summary.last_at.replace(' ', 'T')}Z`, name: summary.last_name, path: summary.last_path } : null,
      drops: drops.map((d) => ({ reason: d.reason, hits: Number(d.hits), detail: d.detail })),
    };
  }

  async siteActivity(siteIds: number[], days: number): Promise<Map<number, SiteActivity>> {
    const out = new Map<number, SiteActivity>();
    if (!siteIds.length) return out;
    // Events grouped to the minute first, so a busy site still yields at most days x 1440 values.
    const rows = await this.ch.query<{ site_id: string; last_at: string; max_gap: string }>(
      `SELECT site_id, toString(max(received_at)) AS last_at,
              arrayMax(arrayPushBack(arrayDifference(arraySort(groupUniqArray(intDiv(toUInt32(toUnixTimestamp(received_at)), 60)))), 0)) AS max_gap
         FROM ${this.ch.database}.events
        WHERE site_id IN {sites:Array(UInt64)} AND received_at >= now64(3) - toIntervalDay({days:UInt32})
        GROUP BY site_id`,
      { sites: `[${siteIds.map((id) => Math.trunc(id)).join(',')}]`, days },
    );
    for (const r of rows) {
      out.set(Number(r.site_id), { lastAt: new Date(`${r.last_at.replace(' ', 'T')}Z`), maxGapMinutes: Number(r.max_gap) });
    }
    return out;
  }

  async wrongHosts(siteIds: number[], days: number): Promise<Map<number, WrongHost[]>> {
    const out = new Map<number, WrongHost[]>();
    if (!siteIds.length) return out;
    const rows = await this.ch.query<{ site_id: string; host: string; hits: string; last_at: string }>(
      `SELECT site_id, detail AS host, sum(hits) AS hits, toString(max(at)) AS last_at
         FROM ${this.ch.database}.dropped_hits
        WHERE site_id IN {sites:Array(UInt64)} AND reason = 'hostname' AND detail != '' AND at >= now64(3) - toIntervalDay({days:UInt32})
        GROUP BY site_id, detail
        ORDER BY site_id, hits DESC`,
      { sites: `[${siteIds.map((id) => Math.trunc(id)).join(',')}]`, days },
    );
    for (const r of rows) {
      const id = Number(r.site_id);
      const list = out.get(id) ?? [];
      list.push({ host: r.host, hits: Number(r.hits), lastAt: new Date(`${r.last_at.replace(' ', 'T')}Z`) });
      out.set(id, list);
    }
    return out;
  }

  async dailyPageviews(siteIds: number[], days: number): Promise<Map<number, number[]>> {
    const out = new Map<number, number[]>();
    if (!siteIds.length) return out;
    const rows = await this.ch.query<{ site_id: string; ago: string; pageviews: string }>(
      `SELECT site_id, intDiv(toUnixTimestamp(now64(3)) - toUnixTimestamp(received_at), 86400) AS ago, count() AS pageviews
         FROM ${this.ch.database}.events
        WHERE site_id IN {sites:Array(UInt64)} AND name = 'pageview' AND received_at > now64(3) - toIntervalDay({days:UInt32})
        GROUP BY site_id, ago`,
      { sites: `[${siteIds.map((id) => Math.trunc(id)).join(',')}]`, days },
    );
    for (const id of siteIds) out.set(id, Array.from({ length: days }, () => 0));
    for (const r of rows) {
      const list = out.get(Number(r.site_id));
      const ago = Number(r.ago);
      if (list && ago >= 0 && ago < days) list[ago] = Number(r.pageviews);
    }
    return out;
  }

  async spikeDetails(siteIds: number[]): Promise<Map<number, SpikeDetails>> {
    const out = new Map<number, SpikeDetails>();
    if (!siteIds.length) return out;
    const p = { sites: `[${siteIds.map((id) => Math.trunc(id)).join(',')}]` };
    const db = this.ch.database;
    const top = (col: string) =>
      this.ch.query<{ site_id: string; label: string; n: string }>(
        `SELECT site_id, ${col} AS label, count() AS n
           FROM ${db}.events
          WHERE site_id IN {sites:Array(UInt64)} AND name = 'pageview' AND received_at > now64(3) - INTERVAL 1 DAY
          GROUP BY site_id, label
          ORDER BY site_id, n DESC
          LIMIT 3 BY site_id`,
        p,
      );
    const [pages, countries, referrers, blocked] = await Promise.all([
      top('pathname'),
      top('country_code'),
      top('referrer_source'),
      this.ch.query<{ site_id: string; hits: string }>(
        `SELECT site_id, sum(hits) AS hits FROM ${db}.dropped_hits
          WHERE site_id IN {sites:Array(UInt64)} AND at > now64(3) - INTERVAL 1 DAY
          GROUP BY site_id`,
        p,
      ),
    ]);
    for (const id of siteIds) out.set(id, { pages: [], countries: [], referrers: [], blocked: 0 });
    const fill = (rows: { site_id: string; label: string; n: string }[], key: 'pages' | 'countries' | 'referrers') => {
      for (const r of rows) out.get(Number(r.site_id))?.[key].push({ label: r.label, count: Number(r.n) });
    };
    fill(pages, 'pages');
    fill(countries, 'countries');
    fill(referrers, 'referrers');
    for (const r of blocked) {
      const d = out.get(Number(r.site_id));
      if (d) d.blocked = Number(r.hits);
    }
    return out;
  }
}


/** The health check's reader, or null when ClickHouse is not configured. */
export const analyticsRepository = readClient ? new AnalyticsReader(readClient) : null;
