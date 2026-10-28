import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { env } from '../config/env.js';
import { hostAllowed } from '../utils/domain.js';
import { ALLOWED_PORTS, guardedFetch, isPublicAddress } from '../utils/netguard.js';
import { attr, cspAllows, findSnippets } from '../utils/snippetHtml.js';

/**
 * The install check. Opens the customer's page as TailwatchVerifier/1.0 (on the collector's bot denylist,
 * so a check never counts as a visit) and reports exactly which step failed, in words the customer can act on.
 */
export const VERIFIER_USER_AGENT = 'TailwatchVerifier/1.0 (+install check; never counted)';

export type CheckId = 'reach' | 'present' | 'noscript' | 'once' | 'id' | 'script' | 'csp';

export interface CheckResult {
  id: CheckId;
  label: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
}

export interface ActiveResult {
  url: string;
  ok: boolean;
  checks: CheckResult[];
  // The page redirects to a host this site does not accept (the site moved): that host.
  movedTo?: string;
}

export interface VerifyTarget {
  domain: string;
  allowedHosts: string[];
  keys: { publicKey: string; status: string }[];
}

/** The steps, in the order a browser goes through them; the dashboard shows the same list. */
export const CHECK_ORDER: CheckId[] = ['reach', 'present', 'noscript', 'once', 'script', 'csp', 'id'];

export const CHECK_LABELS: Record<CheckId, string> = {
  reach: 'Site reachable',
  present: 'Snippet in page source',
  noscript: 'Not in noscript or a comment',
  once: 'Only one snippet',
  script: 'Script loads',
  csp: 'Content-Security-Policy allows it',
  id: 'Site key matches',
};

/** The URL the user typed cannot be checked (not a URL, not http(s), not one of the site's hosts). */
export class VerifyInputError extends Error {}

const MAX_HTML_BYTES = 2_000_000;
const TIMEOUT_MS = 10_000;
const allowPrivate = env.verifierAllowPrivate;

/** SSRF guard: a URL a user typed must never reach our own network. */
async function assertPublic(url: URL): Promise<void> {
  if (allowPrivate) return;
  if (!ALLOWED_PORTS.has(url.port)) throw new Error('blocked port');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  if (addresses.length === 0 || !addresses.every(isPublicAddress)) throw new Error('private address');
}

/**
 * GET with at most 5 redirects (each one checked again), a 10 s timeout and a 2 MB body limit. The real
 * network path also checks the address at connect time (guardedFetch), so DNS rebinding cannot get through.
 */
async function fetchLimited(url: string, accept: string): Promise<{ res: Response; body: string; finalUrl: string }> {
  const doFetch = (allowPrivate ? fetch : guardedFetch) as unknown as typeof fetch;
  let current = new URL(url);
  for (let hop = 0; hop < 5; hop++) {
    await assertPublic(current);
    const res = await doFetch(current, {
      redirect: 'manual',
      headers: { 'user-agent': VERIFIER_USER_AGENT, accept },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      await res.body?.cancel().catch(() => undefined);
      current = new URL(res.headers.get('location')!, current);
      if (current.protocol !== 'https:' && current.protocol !== 'http:') throw new Error('bad redirect');
      continue;
    }
    const reader = res.body?.getReader();
    let size = 0;
    const chunks: Uint8Array[] = [];
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_HTML_BYTES) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }
    return { res, body: Buffer.concat(chunks).toString('utf8'), finalUrl: current.href };
  }
  throw new Error('too many redirects');
}

const result = (id: CheckId, status: CheckResult['status'], message: string): CheckResult => ({ id, label: CHECK_LABELS[id], status, message });

export const verifierService = {
  /**
   * Runs the 7 checks against `rawUrl` (default https://<domain>/), in CHECK_ORDER, and stops at the first
   * one that fails (the steps after it are "not checked": they mean nothing while an earlier step is broken).
   */
  async runActiveCheck(site: VerifyTarget, rawUrl?: string): Promise<ActiveResult> {
    const url = rawUrl?.trim() || `https://${site.domain}/`;
    let page: URL;
    try {
      page = new URL(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`);
    } catch {
      throw new VerifyInputError('That is not a valid URL.');
    }
    if (page.protocol !== 'https:' && page.protocol !== 'http:') throw new VerifyInputError('Only http and https pages can be checked.');
    if (!hostAllowed(page.hostname, site.allowedHosts)) {
      throw new VerifyInputError(`${page.hostname} is not one of this site's hosts (${site.allowedHosts.join(', ')}).`);
    }

    const checks: CheckResult[] = [];
    const stop = (failed: CheckResult): ActiveResult => {
      checks.push(failed);
      for (const id of CHECK_ORDER.slice(checks.length)) checks.push(result(id, 'skip', 'Not checked: fix the step above first.'));
      return { url: page.href, ok: false, checks };
    };

    // 1. Site reachable
    let html = '';
    let headers: Headers;
    let finalUrl = page.href;
    try {
      const got = await fetchLimited(page.href, 'text/html,*/*;q=0.5');
      headers = got.res.headers;
      finalUrl = got.finalUrl;
      if (!got.res.ok) return stop(result('reach', 'fail', `We reached ${page.hostname}, but it answered HTTP ${got.res.status}.`));
      // Redirected to another website: its hits would come from that host and the collector drops them.
      const landed = new URL(finalUrl).hostname;
      if (!hostAllowed(landed, site.allowedHosts)) {
        const moved = stop(
          result('reach', 'fail', `${page.hostname} redirects to ${landed}, which is not this site's domain, so visits there are not counted. If the site moved, change its domain.`),
        );
        return { ...moved, movedTo: landed };
      }
      html = got.body;
      checks.push(result('reach', 'pass', `${new URL(finalUrl).hostname} answered HTTP ${got.res.status}.`));
    } catch (error) {
      const why =
        error instanceof Error && error.name === 'TimeoutError'
          ? 'timeout'
          : error instanceof Error && error.message === 'private address'
            ? 'it resolves to a private network address'
            : error instanceof Error && error.message === 'blocked port'
              ? 'only ports 80, 443, 8080 and 8443 can be checked'
              : 'connection failed';
      return stop(result('reach', 'fail', `We couldn't reach ${page.hostname} (${why}).`));
    }

    // 2. Snippet in page source
    const tags = findSnippets(html, finalUrl);
    const visible = tags.filter((t) => !t.hidden);
    const hidden = tags.filter((t) => t.hidden);
    if (tags.length === 0) {
      return stop(result('present', 'fail', "The snippet isn't in the page source. Paste it inside <head> and publish the change; if you use a cache or CDN, purge it."));
    }
    checks.push(result('present', 'pass', `Found ${tags.length === 1 ? 'the snippet' : `${tags.length} snippets`} in the page source.`));

    // 3. Not in noscript or a comment
    if (visible.length === 0) {
      return stop(result('noscript', 'fail', `The snippet is inside ${hidden[0]!.hidden === 'comment' ? 'an HTML comment' : 'a <noscript> block'}, so it never runs. Move it into <head>.`));
    }
    checks.push(result('noscript', 'pass', 'The snippet is live (not commented out, not in <noscript>).'));

    // 4. Only one snippet
    if (visible.length > 1) {
      return stop(result('once', 'fail', `We found the snippet ${visible.length} times; remove all but one. (The second copy does nothing, but it is a sign of a duplicated template.)`));
    }
    checks.push(result('once', 'pass', 'Exactly one snippet.'));
    const tag = visible[0]!;

    // 5. Script loads
    try {
      const s = await fetchLimited(tag.src, 'application/javascript,*/*;q=0.5');
      const type = s.res.headers.get('content-type') ?? '';
      if (!s.res.ok || !/javascript|ecmascript/i.test(type)) {
        return stop(result('script', 'fail', `The script URL answered HTTP ${s.res.status}${type ? ` (${type.split(';')[0]})` : ''}. Check the src in the snippet.`));
      }
    } catch {
      return stop(result('script', 'fail', `We couldn't load ${tag.src}.`));
    }
    checks.push(result('script', 'pass', 'tw.js loads.'));

    // 6. Content-Security-Policy allows it
    const policies = [
      ...(headers.get('content-security-policy') ? [headers.get('content-security-policy')!] : []),
      ...[...html.matchAll(/<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi)].map((m) => attr(m[0], 'content') ?? ''),
    ].filter(Boolean);
    const pageOrigin = new URL(finalUrl).origin;
    const apiUrl = tag.api ? new URL(tag.api, finalUrl).href : `${new URL(tag.src).origin}/e`;
    if (!cspAllows(policies, 'script-src', tag.src, pageOrigin)) {
      return stop(result('csp', 'fail', `The script is blocked: add ${new URL(tag.src).origin} to your Content-Security-Policy script-src.`));
    }
    if (!cspAllows(policies, 'connect-src', apiUrl, pageOrigin)) {
      return stop(result('csp', 'fail', `Hits are blocked: add ${new URL(apiUrl).origin} to your Content-Security-Policy connect-src.`));
    }
    checks.push(result('csp', 'pass', policies.length ? 'Your Content-Security-Policy allows the script and its hits.' : 'No Content-Security-Policy restricts it.'));

    // 7. Site key matches
    const active = new Set(site.keys.filter((k) => k.status === 'active').map((k) => k.publicKey));
    const known = new Set(site.keys.map((k) => k.publicKey));
    if (!tag.key) return stop(result('id', 'fail', 'The snippet has no site key (?id=tw_pub_...). Copy the snippet again.'));
    if (known.has(tag.key) && !active.has(tag.key)) return stop(result('id', 'fail', 'The snippet uses a key you revoked. Copy the current snippet again.'));
    if (!active.has(tag.key)) return stop(result('id', 'fail', `The snippet on your site uses a different site key (${tag.key}). Copy this site's snippet and replace the old one.`));
    checks.push(result('id', 'pass', "The snippet uses this site's key."));

    return { url: page.href, ok: true, checks };
  },

  /**
   * Is anything answering at this domain? Asked before a setup starts, so a typo or an invented domain is
   * refused at once. Any HTTP answer counts (even 403 or 404); only "nothing answers" fails.
   */
  async probeDomain(domain: string): Promise<{ ok: true } | { ok: false; why: string }> {
    let why = 'connection failed';
    for (const scheme of ['https', 'http']) {
      try {
        const got = await fetchLimited(`${scheme}://${domain}/`, 'text/html,*/*;q=0.5');
        await got.res.body?.cancel().catch(() => undefined);
        return { ok: true };
      } catch (error) {
        const e = error instanceof Error ? error : null;
        if (e?.name === 'TimeoutError') why = 'no answer within 10 seconds';
        else if (e?.message === 'private address') return { ok: false, why: 'it points to a private network address' };
        else if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(`${e?.message} ${(e as { code?: string } | null)?.code ?? ''}`)) why = 'the domain does not exist (no DNS record)';
      }
    }
    return { ok: false, why };
  },
};
