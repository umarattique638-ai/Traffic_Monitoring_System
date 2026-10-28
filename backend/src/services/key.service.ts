import { MAX_ACTIVE_KEYS } from '../config/tailwatch.constants.js';
import type { ISite, SiteDocument, SiteKey } from '../models/site.model.js';
import type { UserDocument } from '../models/user.model.js';
import { AppError } from '../utils/AppError.js';
import { newKeyId, newPublicKey, shortKey } from '../utils/siteSecrets.js';
import { auditService } from './audit.service.js';
import { kvSyncService } from './kvSync.service.js';
import { siteService } from './site.service.js';

const plainKeys = (site: SiteDocument): SiteKey[] => (site.toObject() as ISite).keys;

/** Site keys. Rotation is "add a new key, swap the snippet, revoke the old one". */
export const keyService = {
  /** Rotation, step 1: add a new active key. Both keys work until the old one is revoked. */
  async create(user: UserDocument, site: SiteDocument): Promise<SiteDocument> {
    if (site.keys.filter((k) => k.status === 'active').length >= MAX_ACTIVE_KEYS) {
      throw AppError.conflict('Revoke an old key before adding another.', 'too_many_keys');
    }
    const fresh: SiteKey = { id: newKeyId(), publicKey: newPublicKey(), createdAt: new Date(), revokedAt: null, status: 'active' };
    const keys = [...plainKeys(site), fresh];
    // Grant: the new key is written to KV first, so it is never shown (or put in a snippet) before it works.
    await kvSyncService.activateFirst({ ...(site.toObject() as ISite), keys }, [fresh.publicKey]);
    let updated: SiteDocument;
    try {
      updated = await siteService.patch(site, { keys });
    } catch (error) {
      await kvSyncService.rollbackGrant(site.toObject() as ISite, [fresh.publicKey]);
      throw error;
    }
    await auditService.record(user, 'key.created', updated, `Added key ${shortKey(fresh.publicKey)} to ${site.domain}`);
    return updated;
  },

  /** Rotation, step 2. The last active key cannot go: the site would stop counting. */
  async revoke(user: UserDocument, site: SiteDocument, keyId: string) {
    const target = site.keys.find((k) => k.id === keyId);
    if (!target) throw AppError.notFound('No such key.');
    if (target.status === 'active' && site.keys.filter((k) => k.status === 'active').length === 1) {
      throw AppError.conflict('This is the only active key. Add a new key first, update your snippet, then revoke this one.', 'last_key');
    }
    const at = new Date();
    const keys = plainKeys(site).map((k) => (k.id === keyId ? { ...k, status: 'revoked' as const, revokedAt: k.revokedAt ?? at } : k));
    const updated = await siteService.patch(site, { keys });
    const sync = await kvSyncService.sync(updated);
    if (target.status === 'active') await auditService.record(user, 'key.revoked', updated, `Revoked key ${shortKey(target.publicKey)} of ${site.domain}`);
    return { site: updated, sync };
  },
};
