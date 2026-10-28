import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { env } from '../config/env.js';
import type { ISite } from '../models/site.model.js';

/**
 * Cloudflare Workers KV: the collector never touches a database, it reads ONE KV entry per site key
 * ("site:<publicKey>"). MongoDB is the source of truth; KV is a copy written by this API after every change.
 */
export interface PutOptions {
  /** The entry deletes itself after this many seconds (Cloudflare minimum: 60). */
  ttlSeconds?: number;
}

export interface KvStore {
  get(name: string): Promise<string | null>;
  put(name: string, value: string, options?: PutOptions): Promise<void>;
  delete(name: string): Promise<void>;
}

/** What the collector reads for one key (workers/contract SiteConfig). */
export interface SiteConfig {
  id: number;
  publicKey: string;
  allowedHosts: string[];
  live: boolean;
  region: 'in' | 'in-eu';
  identitySecret?: string;
  // A site still being set up: the collector accepts its hits but stores nothing.
  setup?: boolean;
}

/** The fields of a site that KV needs. */
export type KvSite = Pick<ISite, '_id' | 'allowedHosts' | 'status' | 'region' | 'identitySecret' | 'keys'>;

export const kvName = (publicKey: string) => `site:${publicKey}`;

export function siteConfig(site: KvSite, publicKey: string): SiteConfig {
  return {
    id: site._id,
    publicKey,
    allowedHosts: site.allowedHosts,
    live: site.status === 'active',
    region: site.region,
    identitySecret: site.identitySecret,
  };
}

/** Cloudflare KV through the REST API (token permission "Account > Workers KV Storage > Edit"). */
class CloudflareKv implements KvStore {
  constructor(
    private readonly accountId: string,
    private readonly namespaceId: string,
    private readonly token: string,
  ) {}

  private url(name: string) {
    return `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/storage/kv/namespaces/${this.namespaceId}/values/${encodeURIComponent(name)}`;
  }

  async get(name: string): Promise<string | null> {
    const res = await fetch(this.url(name), { headers: { authorization: `Bearer ${this.token}` }, signal: AbortSignal.timeout(5_000) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Cloudflare KV GET ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.text();
  }

  private async call(method: 'PUT' | 'DELETE', name: string, body?: string, ttlSeconds?: number) {
    const ttl = ttlSeconds ? `?expiration_ttl=${Math.max(60, Math.round(ttlSeconds))}` : '';
    const res = await fetch(this.url(name) + ttl, {
      method,
      headers: { authorization: `Bearer ${this.token}`, ...(body === undefined ? {} : { 'content-type': 'text/plain' }) },
      body,
      signal: AbortSignal.timeout(5_000),
    });
    // Deleting a key that is not there is fine.
    if (!res.ok && !(method === 'DELETE' && res.status === 404)) {
      throw new Error(`Cloudflare KV ${method} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
  }

  put(name: string, value: string, options?: PutOptions) {
    return this.call('PUT', name, value, options?.ttlSeconds);
  }

  delete(name: string) {
    return this.call('DELETE', name);
  }
}

/**
 * Local development: the KV of `npm run dev` in workers/ (wrangler's local state), written with the
 * wrangler CLI. So the whole system runs on one computer without a Cloudflare account.
 */
class LocalWranglerKv implements KvStore {
  private readonly cwd = path.resolve(env.kv.localWorkersDir);
  private readonly run = promisify(execFile);

  private args(...rest: string[]) {
    return ['wrangler', 'kv', 'key', ...rest, '--binding', 'SITE_CONFIG', '--local', '--preview', '--persist-to', '.wrangler/state', '--config', 'collector/wrangler.toml'];
  }

  async get(name: string): Promise<string | null> {
    try {
      const { stdout } = await this.run('npx', this.args('get', name, '--text'), { cwd: this.cwd });
      const value = stdout.trim();
      return value && value !== 'Value not found' ? value : null;
    } catch {
      return null;
    }
  }

  async put(name: string, value: string, options?: PutOptions) {
    const ttl = options?.ttlSeconds ? ['--ttl', String(Math.max(60, Math.round(options.ttlSeconds)))] : [];
    await this.run('npx', [...this.args('put', name, value), ...ttl], { cwd: this.cwd });
  }

  async delete(name: string) {
    await this.run('npx', this.args('delete', name), { cwd: this.cwd }).catch(() => undefined);
  }
}

/** Without Cloudflare credentials every write fails with a message that says what to set. */
class UnconfiguredKv implements KvStore {
  async get(): Promise<string | null> {
    throw new Error('Cloudflare KV is not configured: set CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID and CF_API_TOKEN in .env');
  }
  async put(): Promise<void> {
    await this.get();
  }
  async delete(): Promise<void> {
    await this.get();
  }
}

function createKv(): KvStore {
  if (env.kv.mode === 'local') return new LocalWranglerKv();
  if (env.kv.accountId && env.kv.namespaceId && env.kv.apiToken) return new CloudflareKv(env.kv.accountId, env.kv.namespaceId, env.kv.apiToken);
  return new UnconfiguredKv();
}

export const kv: KvStore = createKv();

export class KvSyncError extends Error {
  constructor(readonly causeError: unknown) {
    super(`KV sync failed: ${causeError instanceof Error ? causeError.message : String(causeError)}`);
  }
}

const firstFailure = (results: PromiseSettledResult<unknown>[]) => results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;

export const kvRepository = {
  /** Writes every active key, deletes revoked ones (and every key of a deleted site). */
  async syncSite(site: KvSite): Promise<void> {
    const writes = site.keys.map((k) =>
      k.status === 'active' && site.status !== 'deleted'
        ? kv.put(kvName(k.publicKey), JSON.stringify(siteConfig(site, k.publicKey)))
        : kv.delete(kvName(k.publicKey)),
    );
    const failed = firstFailure(await Promise.allSettled(writes));
    if (failed) throw new KvSyncError(failed.reason);
  },

  /** Writes only these keys (a new key being activated). */
  async putKeys(site: KvSite, publicKeys: string[]): Promise<void> {
    const failed = firstFailure(await Promise.allSettled(publicKeys.map((k) => kv.put(kvName(k), JSON.stringify(siteConfig(site, k))))));
    if (failed) throw new KvSyncError(failed.reason);
  },

  /** Best-effort removal. Never throws; true when every key is gone. */
  async deleteKeys(publicKeys: string[]): Promise<boolean> {
    const results = await Promise.allSettled(publicKeys.map((k) => kv.delete(kvName(k))));
    return results.every((r) => r.status === 'fulfilled');
  },

  /** What KV must hold for this site: name -> value for every live key, null for every key that must be gone. */
  expectedEntries(site: KvSite): Map<string, string | null> {
    const out = new Map<string, string | null>();
    for (const k of site.keys) {
      out.set(kvName(k.publicKey), k.status === 'active' && site.status !== 'deleted' ? JSON.stringify(siteConfig(site, k.publicKey)) : null);
    }
    return out;
  },

  get: (name: string) => kv.get(name),

  /** A KV failure in words the site owner can act on (never the raw Cloudflare body). */
  problem(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error);
    if (/not configured/i.test(raw)) return 'Cloudflare KV is not configured on the server (CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID, CF_API_TOKEN).';
    const status = /Cloudflare KV \w+ (\d{3})/.exec(raw)?.[1];
    if (status === '401' || status === '403' || /authentication error/i.test(raw)) {
      return `Cloudflare refused the server's API token (HTTP ${status ?? '401'}). Create a token with "Account > Workers KV Storage > Edit", put it in CF_API_TOKEN and redeploy.`;
    }
    if (status === '429') return 'Cloudflare is rate limiting the server (HTTP 429). Try again in a minute.';
    if (status) return `Cloudflare KV answered HTTP ${status}. Try again in a minute.`;
    if (/timeout|abort|fetch failed|network|ENOTFOUND|ECONN/i.test(raw)) return 'Cloudflare could not be reached (network or timeout). Try again in a minute.';
    return 'Writing to Cloudflare KV failed. Try again in a minute.';
  },
};
