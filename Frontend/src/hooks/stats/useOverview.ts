import { useLiveQuery, useOverviewQuery } from '../../features/stats/statsApi'
import type { OverviewFilters, RangeKey } from '../../types/tailwatch'
import { polled } from './polled'

export const OVERVIEW_EVERY_MS = 30_000
export const LIVE_EVERY_MS = 10_000

/**
 * KPIs, charts and top lists for one site and period, refreshed every 30 seconds while the tab is visible.
 * The sidebar's capture rate asks for the same report: RTK Query answers both with one request.
 */
export function useOverview(siteId: number, range: RangeKey, filters: OverviewFilters = {}) {
  return polled(
    useOverviewQuery({ siteId, range, filters }, { pollingInterval: OVERVIEW_EVERY_MS, skipPollingIfUnfocused: true }),
  )
}

/** Active visitors and the latest hits, refreshed every 10 seconds. */
export function useLive(siteId: number) {
  return polled(useLiveQuery(siteId, { pollingInterval: LIVE_EVERY_MS, skipPollingIfUnfocused: true }))
}

/** "Good morning" by the browser's clock. */
export function greeting(now = new Date()) {
  const h = now.getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}
