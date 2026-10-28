import type { Site } from '../../types/tailwatch'
import { change } from '../../utils/format'
import { useCsvExport } from './useCsvExport'
import { useLive, useOverview } from './useOverview'
import { useOverviewFilters } from './useOverviewFilters'
import { useRange } from './useRange'

/**
 * Below this many visits a bounce rate says little (1 visit = 0% or 100%): the real value is still shown,
 * with how many visits it comes from, and no change vs the previous period.
 */
export const MIN_SESSIONS_FOR_RATE = 10

/** Everything the Overview page shows for one site: the reports, the period, the filters, and the changes. */
export function useDashboard(site: Site) {
  const [range, setRange] = useRange()
  const filter = useOverviewFilters(site.id)
  const overview = useOverview(site.id, range, filter.filters)
  const live = useLive(site.id)
  const csv = useCsvExport(site.id, range)
  const o = overview.data
  const k = o?.kpis

  const enoughNow = !!k && k.sessions >= MIN_SESSIONS_FOR_RATE
  const enoughBefore = !!k && k.previous.sessions >= MIN_SESSIONS_FOR_RATE
  const visitTime = k?.avgVisitMs ?? null

  const changes = {
    sessions: k ? change(k.sessions, k.previous.sessions) : null,
    pageviews: k ? change(k.pageviews, k.previous.pageviews) : null,
    /** In percentage points, only when both periods have enough visits. */
    bounce:
      k && enoughNow && enoughBefore && k.bounceRate !== null && k.previous.bounceRate !== null
        ? (k.bounceRate - k.previous.bounceRate) * 100
        : null,
    visitTime: k && visitTime !== null && k.previous.avgVisitMs ? change(visitTime, k.previous.avgVisitMs) : null,
  }

  const sourcesTotal = o ? o.sources.reduce((s, x) => s + x.sessions, 0) || 1 : 1
  const sources = (o?.sources ?? []).map((s) => ({
    name: s.name,
    value: Math.round((s.sessions / sourcesTotal) * 100),
  }))

  return {
    range,
    setRange,
    filter,
    overview,
    live,
    csv,
    o,
    k,
    l: live.data,
    enoughNow,
    visitTime,
    changes,
    sources,
    tz: o?.range.tz ?? site.timezone,
  }
}

/** "Umar Attique" -> "Umar"; no name -> the part of the e-mail before @. */
export const firstName = (u: { name?: string | null; email: string }) =>
  u.name?.trim().split(/\s+/)[0] || u.email.split('@')[0]!

export const todayLabel = () =>
  new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
