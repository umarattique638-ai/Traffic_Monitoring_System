import { useMemo, useState } from 'react'
import { useEventsQuery } from '../../features/stats/statsApi'
import type { RangeKey } from '../../types/tailwatch'
import { polled } from './polled'

export type EventFilter = 'all' | 'automatic' | 'custom'

/** Events of a site in a period, with the page's filter and search applied, and the totals for the KPI cards. */
export function useEventsReport(siteId: number, range: RangeKey) {
  const report = polled(useEventsQuery({ siteId, range }, { pollingInterval: 60_000, skipPollingIfUnfocused: true }))
  const [filter, setFilter] = useState<EventFilter>('all')
  const [query, setQuery] = useState('')
  const events = useMemo(() => report.data?.events ?? [], [report.data])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return events.filter((e) => (filter === 'all' || e.kind === filter) && e.name.toLowerCase().includes(q))
  }, [events, filter, query])

  const totals = useMemo(
    () => ({
      events: events.reduce((a, e) => a + e.events, 0),
      types: events.length,
      custom: events.filter((e) => e.kind === 'custom').length,
      max: Math.max(1, ...events.map((e) => e.events)),
    }),
    [events],
  )

  return {
    report,
    rows,
    totals,
    filter,
    setFilter,
    query,
    setQuery,
    highCardinality: report.data?.highCardinality ?? [],
  }
}
