// Traffic monitoring types: the same shapes the backend DTOs send (backend/src/dtos, backend/src/types/stats.types.ts).

export type HealthStatus = 'healthy' | 'quiet' | 'broken' | 'unknown' | 'paused'

export interface SiteKey {
  id: string
  publicKey: string
  status: 'active' | 'revoked'
  createdAt: string
  revokedAt: string | null
}

export interface Site {
  id: number
  domain: string
  timezone: string
  allowedHosts: string[]
  status: 'active' | 'paused'
  region: string
  verifiedAt: string | null
  createdAt: string
  /** Days collected data is kept; older data is deleted by the nightly clean-up. */
  retentionDays: number
  /** The newest active key (the one in the snippet). */
  publicKey: string | null
  keys: SiteKey[]
  /** Only in the site list: is it still sending data? */
  health?: HealthStatus
}

/** GET /sites/:id/health. `reason` and `failedCheck` only when broken. */
export interface SiteHealth {
  status: HealthStatus
  reason: string | null
  failedCheck: string | null
  failedLabel: string | null
  /** failedCheck "moved": the domain the visits now come from. */
  movedTo: string | null
  since: string | null
  checkedAt: string | null
  lastEventAt: string | null
  silentForHours: number | null
  silentHours: number | null
}

/** Did a change reach Cloudflare KV? `pending`: saved, the server retries. */
export interface Sync {
  ok: boolean
  pending?: boolean
  message?: string
}

/** A site whose Cloudflare KV entries do not match yet. Retried automatically by the server. */
export interface KvIssue {
  siteId: number
  domain: string
  deleted: boolean
  error: string
  since: string
  attempts: number
}

export interface Snippet {
  id: string
  group: 'script-tag' | 'custom-event'
  label: string
  language: string
  code: string
  note?: string
}

/** A site being set up. It is NOT a site yet: nothing is stored until every install check passes. */
export interface Setup {
  domain: string
  timezone: string
  allowedHosts: string[]
  publicKey: string
  startedAt: string
  expiresAt: string
  snippets: Snippet[]
}

export interface Check {
  id: string
  label: string
  status: 'pass' | 'fail' | 'skip'
  message: string
}

/** The install check. `site` is the saved site, present once every step passed. */
export interface VerifyResult {
  url: string
  ok: boolean
  checks: Check[]
  verifiedAt: string | null
  site: Site | null
}

export interface ChangeDomainResult {
  url: string
  ok: boolean
  checks: Check[]
  site: Site | null
}

// ------------------------------------------------------------------ stats

export type RangeKey = 'today' | '7d' | '30d'

export interface Range {
  key: RangeKey
  tz: string
  from: string
  to: string
  days: number
  hourly: boolean
  prev: { from: string; to: string }
}

export interface Bar {
  label: string
  value: number
}

export type FilterKey = 'page' | 'country' | 'source' | 'device' | 'browser'
export type OverviewFilters = Partial<Record<FilterKey, string>>

export interface Kpis {
  visitors: number
  visitorsEstimated: boolean
  sessions: number
  pageviews: number
  bounceRate: number | null
  avgVisitMs?: number | null
  previous: {
    visitors: number
    sessions: number
    pageviews: number
    bounceRate: number | null
    avgVisitMs?: number | null
  }
}

export interface DropSummary {
  reason: string
  hits: number
  detail: string
  last: number
}

export interface Overview {
  range: Range
  kpis: Kpis
  series: { bucket: string; label: string; visitors: number; sessions: number; pageviews: number }[]
  sources: { name: string; sessions: number }[]
  referrers: Bar[]
  pages: Bar[]
  countries: Bar[]
  devices: Bar[]
  browsers: Bar[]
  capture: { received: number; expected: number; rate: number | null }
  drops: DropSummary[]
}

export interface Live {
  now: number
  active: number
  minutes: { minute: number; visitors: number }[]
  events: { name: string; path: string; country: string; at: number }[]
}

export interface EventsReport {
  range: Range
  events: {
    name: string
    kind: 'automatic' | 'custom'
    events: number
    last: number
    firstSeen: number
    isNew: boolean
  }[]
  highCardinality: { name: string; key: string; distinctValues: number }[]
}

export interface DropsReport {
  range: Range
  rows: { reason: string; detail: string; country: string; asn: number; hits: number; last: number }[]
}

/** A saved CSV export (Reports page). Kept 90 days, then deleted automatically. */
export interface Report {
  id: string
  range: RangeKey
  from: string
  to: string
  timezone: string
  filename: string
  rows: number
  bytes: number
  createdAt: string
  expiresAt: string
}

// ------------------------------------------------------------------ account

export interface Retention {
  choices: number[]
  max: number
  default: number
}

export interface AuditEntry {
  id: string
  at: string
  action: string
  actor: { kind: 'user' | 'system'; name: string; you: boolean }
  siteId: number | null
  domain: string | null
  summary: string
}

/** What happens after an account is deleted. */
export interface Erasure {
  id: string
  sites: number
  trackingStopped: boolean
  dataDeleteSent: boolean
  finishesWithinDays: number
}
