// Site input rules: the domain a customer types, the hosts we accept for it, and its timezone.

/** "https://www.Example.com/path" -> "example.com". Null when it is not a public host name. */
export function normalizeDomain(input: string): string | null {
  const raw = input.trim();
  if (!raw || raw.length > 300) return null;
  let host: string;
  try {
    host = new URL(raw.includes('://') ? raw : `http://${raw}`).hostname;
  } catch {
    return null;
  }
  host = host.toLowerCase().replace(/\.$/, '');
  if (host.startsWith('www.')) host = host.slice(4);
  if (host.length > 253 || host.startsWith('[')) return null; // IPv6 literal
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null; // IPv4 literal: not a site domain
  const labels = host.split('.');
  if (labels.length < 2) return null; // "localhost", "intranet"
  const label = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
  if (!labels.every((l) => label.test(l))) return null;
  if (/^\d+$/.test(labels[labels.length - 1]!)) return null;
  return host;
}

/** Accept the domain and every subdomain (www included), so nothing is lost on www.example.com. */
export function allowedHostsFor(domain: string): string[] {
  return [domain, `*.${domain}`];
}

/** Canonical IANA spelling ("asia/karachi" -> "Asia/Karachi"), or null when the runtime does not know it. */
export function canonicalTimezone(tz: string): string | null {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return null;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

/**
 * Is `host` one of the allowed hosts? "*.example.com" matches subdomains only, label-aware
 * ("evil-example.com" does not match). The same rule as the collector (workers/contract/src/url.ts).
 */
export function hostAllowed(host: string, allowed: readonly string[]): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  return allowed.some((raw) => {
    const a = raw.trim().toLowerCase().replace(/\.$/, '');
    if (!a) return false;
    if (a.startsWith('*.')) {
      const base = a.slice(2);
      return base !== '' && h.length > base.length + 1 && h.endsWith('.' + base);
    }
    return h === a;
  });
}
