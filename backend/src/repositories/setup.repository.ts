import { env } from '../config/env.js';
import { SETUP_TTL_DAYS } from '../config/tailwatch.constants.js';
import { AppError } from '../utils/AppError.js';
import { allowedHostsFor } from '../utils/domain.js';
import { errorText } from '../utils/text.js';
import { kv, kvName, kvRepository } from './kv.repository.js';
import type { SiteConfig } from './kv.repository.js';

/**
 * A site being set up: NOTHING is stored in MongoDB or ClickHouse until every install check passed.
 * Until then the setup lives only in Cloudflare KV, in two entries that delete themselves after SETUP_TTL_DAYS:
 *
 *   setup:<user id>   the domain, timezone and key being set up (one setup at a time per account)
 *   site:<key>        what the collector reads; `setup: true`, so nothing is queued for this key
 *
 * A wrong or abandoned domain therefore leaves nothing behind: the entries simply expire.
 */
export interface Setup {
  domain: string;
  timezone: string;
  publicKey: string;
  startedAt: string;
}

const TTL_SECONDS = SETUP_TTL_DAYS * 86_400;
const setupName = (ownerId: string) => `setup:${ownerId}`;

/** The collector's entry for a key being set up: accepted from the site's hosts, but never stored. */
function setupSiteConfig(setup: Setup): SiteConfig {
  return { id: 0, publicKey: setup.publicKey, allowedHosts: allowedHostsFor(setup.domain), live: true, region: env.region, setup: true };
}

async function read(name: string): Promise<string | null> {
  try {
    return await kv.get(name);
  } catch (error) {
    console.error(JSON.stringify({ tw: 'setup_read_failed', message: errorText(error) }));
    throw new AppError(503, 'setup_unavailable', kvRepository.problem(error));
  }
}

async function write(name: string, value: string): Promise<void> {
  try {
    await kv.put(name, value, { ttlSeconds: TTL_SECONDS });
  } catch (error) {
    console.error(JSON.stringify({ tw: 'setup_write_failed', message: errorText(error) }));
    throw new AppError(503, 'activation_failed', `${kvRepository.problem(error)} Nothing was saved.`);
  }
}

/** Best effort: the entries expire by themselves anyway. */
async function forget(names: string[]): Promise<void> {
  await Promise.allSettled(names.map((n) => kv.delete(n)));
}

export const setupRepository = {
  /** The account's setup in progress, or null. */
  async get(ownerId: string): Promise<Setup | null> {
    const raw = await read(setupName(ownerId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Setup;
    } catch {
      return null;
    }
  },

  /** Starts (or replaces) the setup: the collector entry first, so the snippet works at once. */
  async start(ownerId: string, setup: Setup): Promise<void> {
    await write(kvName(setup.publicKey), JSON.stringify(setupSiteConfig(setup)));
    await write(setupName(ownerId), JSON.stringify(setup));
  },

  /** Keeps the same key (the snippet stays valid), with a new timezone. */
  async update(ownerId: string, setup: Setup): Promise<void> {
    await write(setupName(ownerId), JSON.stringify(setup));
  },

  /** Cancelled or replaced: the key stops working and nothing is left. */
  async cancel(ownerId: string, setup: Setup): Promise<void> {
    await forget([setupName(ownerId), kvName(setup.publicKey)]);
  },

  /** Verified: the site now lives in MongoDB and its key entry was rewritten, so only the setup entry goes. */
  async finish(ownerId: string): Promise<void> {
    await forget([setupName(ownerId)]);
  },
};
