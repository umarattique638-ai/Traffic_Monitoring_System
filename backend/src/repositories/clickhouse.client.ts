import { env } from '../config/env.js';

/**
 * A small ClickHouse HTTP client: parameterised queries ({name:Type}, values never pasted into SQL),
 * JSON rows, 64-bit numbers as strings. Credentials go in headers, never in the URL.
 */
export class ClickHouseClient {
  constructor(
    private readonly url: string,
    private readonly user: string,
    private readonly password: string,
    readonly database = 'tailwatch',
    // A hosted function has about 30 s in total; ClickHouse Cloud waking from idle can take ~15 s.
    private readonly timeoutMs = 20_000,
  ) {}

  async query<T>(sql: string, params: Record<string, string | number>): Promise<T[]> {
    const text = await this.send(sql, params);
    return (JSON.parse(text) as { data: T[] }).data;
  }

  /** A statement without a result (ALTER ... DELETE). */
  async exec(sql: string, params: Record<string, string | number>): Promise<void> {
    await this.send(sql, params);
  }

  private async send(sql: string, params: Record<string, string | number>): Promise<string> {
    const qs = new URLSearchParams({ default_format: 'JSON', output_format_json_quote_64bit_integers: '1' });
    for (const [k, v] of Object.entries(params)) qs.set(`param_${k}`, String(v));
    const send = () =>
      fetch(`${this.url.replace(/\/+$/, '')}/?${qs}`, {
        method: 'POST',
        headers: { 'X-ClickHouse-User': this.user, 'X-ClickHouse-Key': this.password },
        body: sql,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    let res: Response;
    try {
      res = await send();
    } catch {
      // One retry on a network failure (dropped keep-alive, a service waking up). A ClickHouse ERROR is never retried.
      res = await send();
    }
    const text = await res.text();
    if (!res.ok) throw new Error(`ClickHouse ${res.status}: ${text.slice(0, 300)}`);
    return text;
  }
}

const ch = env.clickhouse;

/** The read-only client of the dashboard (tw_read), or null when ClickHouse is not configured. */
export const readClient = ch.url && ch.readPassword ? new ClickHouseClient(ch.url, ch.readUser, ch.readPassword, ch.database) : null;

/** The deleting client of retention and erasure (tw_prune), or null when it is not configured. */
export const pruneClient = ch.url && ch.prunePassword ? new ClickHouseClient(ch.url, ch.pruneUser, ch.prunePassword, ch.database) : null;
