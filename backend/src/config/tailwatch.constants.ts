// Limits and lifetimes of traffic monitoring, in one place (several are shown in the dashboard too).

/** Retention a customer can choose for a site, in days (never above env.retentionDays). */
export const RETENTION_CHOICES = [30, 90, 180, 395] as const;

/** A site being set up lives this long in Cloudflare KV, then deletes itself. */
export const SETUP_TTL_DAYS = 7;

/** Active keys a site may have at once (rotation needs two). */
export const MAX_ACTIVE_KEYS = 3;

/** Hosts a site may accept. */
export const MAX_ALLOWED_HOSTS = 50;

/** Saved reports (CSV) are deleted this many days after they were made. */
export const REPORT_KEEP_DAYS = 90;

/** Saved reports per site at one time. */
export const REPORT_MAX = 200;

/** Activity-log entries are deleted this many days after they were written. */
export const AUDIT_KEEP_DAYS = 400;

/** What "Delete account" must receive, typed by the user. */
export const DELETE_CONFIRMATION = 'DELETE';
