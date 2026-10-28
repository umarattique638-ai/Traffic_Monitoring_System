import dotenv from 'dotenv';

dotenv.config({ quiet: true });

// Read a variable that must be set; stop the app early if it is missing.
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

// Read a number; an empty or missing value falls back to the default.
function numberOr(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number.`);
  return value;
}

// Read a number that must be set in .env.
function requiredNumber(name: string): number {
  const value = Number(required(name));
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number.`);
  return value;
}

// Comma-separated e-mails. These accounts are always super admins and cannot be demoted, blocked or deleted.
function emailList(name: string): string[] {
  return (process.env[name] ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes('@'));
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters long.');

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: numberOr('PORT', 5000),
  appName: process.env.APP_NAME ?? 'Traffic Monitoring',
  // Comma-separated list. The first one is used for links in e-mails.
  clientUrl: required('CLIENT_URL'),
  mongoUrl: required('MONGO_URL'),
  jwtSecret,
  superAdminEmails: emailList('SUPER_ADMIN_EMAILS'),
  // Access token (JWT in a cookie): short, checked without the database.
  accessTokenMinutes: requiredNumber('ACCESS_TOKEN_MINUTES'),
  // Refresh token: a login ends after this many days without use...
  sessionDays: requiredNumber('SESSION_DAYS'),
  // ...and after this many days in any case, even when used every day.
  sessionMaxDays: requiredNumber('SESSION_MAX_DAYS'),

  // E-mail (SMTP). When SMTP_HOST is empty, e-mails are printed in the terminal instead of being sent.
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: numberOr('SMTP_PORT', 587),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
  },
  mailFrom: process.env.MAIL_FROM ?? 'Traffic Monitoring <no-reply@example.com>',

  // ---------- Traffic monitoring (TailWatch) ----------

  // Public address of the collector Worker (serves /tw.js and receives /e). Goes into every snippet.
  collectorUrl: (process.env.COLLECTOR_URL ?? 'http://localhost:8787').replace(/\/+$/, ''),
  // Region of this deployment; must match the collector's REGION var (wrangler.toml).
  region: process.env.REGION === 'in-eu' ? ('in-eu' as const) : ('in' as const),
  // Site ids are shared with ClickHouse (events.site_id). New sites get ids above this number.
  siteIdFloor: numberOr('SITE_ID_FLOOR', 100),
  // Days collected data is kept for a new site, and the longest a site can choose.
  retentionDays: numberOr('RETENTION_DAYS', 395),
  // Refuse to add a domain when nothing answers there (off: TAILWATCH_SKIP_DOMAIN_CHECK=true).
  checkDomainReachable: process.env.TAILWATCH_SKIP_DOMAIN_CHECK !== 'true',
  // Development only: the install check may open pages on private addresses (localhost).
  verifierAllowPrivate: process.env.NODE_ENV !== 'production' && process.env.VERIFIER_ALLOW_PRIVATE === 'true',
  // The operator: told when most sites stop sending data at once (the fault is then in the pipeline).
  ownerEmail: process.env.OWNER_EMAIL?.trim().toLowerCase() || null,
  // Shared secret of the scheduled jobs (Vercel Cron sends it as "Authorization: Bearer ...").
  cronSecret: process.env.CRON_SECRET || null,

  // Cloudflare Workers KV: the collector reads one entry per site key ("site:<key>").
  // KV_MODE=cloudflare (default) uses the REST API; KV_MODE=local writes the local `wrangler dev` KV.
  kv: {
    mode: process.env.KV_MODE === 'local' ? ('local' as const) : ('cloudflare' as const),
    accountId: process.env.CF_ACCOUNT_ID ?? '',
    namespaceId: process.env.CF_KV_NAMESPACE_ID ?? '',
    apiToken: process.env.CF_API_TOKEN ?? '',
    // KV_MODE=local only: the workers folder and its wrangler state directory.
    localWorkersDir: process.env.KV_LOCAL_WORKERS_DIR ?? '../workers',
  },

  // ClickHouse: the dashboard reads with tw_read (read-only); retention and erasure delete with tw_prune.
  clickhouse: {
    url: process.env.CLICKHOUSE_URL ?? '',
    database: process.env.CLICKHOUSE_DATABASE ?? 'tailwatch',
    readUser: process.env.CLICKHOUSE_READ_USER ?? 'tw_read',
    readPassword: process.env.CLICKHOUSE_READ_PASSWORD ?? '',
    pruneUser: process.env.CLICKHOUSE_PRUNE_USER ?? 'tw_prune',
    prunePassword: process.env.CLICKHOUSE_PRUNE_PASSWORD ?? '',
  },
};

if (env.sessionMaxDays < env.sessionDays) throw new Error('SESSION_MAX_DAYS must be at least SESSION_DAYS.');
if (env.isProd && !env.smtp.host) throw new Error('Missing env: SMTP_HOST (required in production).');
