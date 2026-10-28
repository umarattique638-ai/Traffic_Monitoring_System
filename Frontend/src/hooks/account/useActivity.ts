import { useMemo, useState } from 'react'
import { useActivityQuery } from '../../features/account/accountApi'
import type { AuditEntry } from '../../types/tailwatch'
import { errorMessage } from '../../utils/apiError'

const dayKey = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}
const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

/** The activity log, newest first, 50 at a time, optionally for one site, grouped by local day. */
export function useActivity() {
  const [site, setSiteValue] = useState<number | null>(null)
  const [before, setBefore] = useState<string | null>(null)
  const { data, currentData, isFetching, error, refetch } = useActivityQuery({ site, before })
  // While an older page loads, keep showing the list (same cache entry); a new site filter starts empty.
  const page = currentData ?? (before ? data : undefined)
  const entries = page?.data.entries ?? null
  const next = page?.data.next ?? null

  const days = useMemo(() => {
    const out: { key: string; label: string; items: AuditEntry[] }[] = []
    for (const e of entries ?? []) {
      const key = dayKey(e.at)
      const last = out[out.length - 1]
      if (last && last.key === key) last.items.push(e)
      else out.push({ key, label: dayFmt.format(new Date(e.at)), items: [e] })
    }
    return out
  }, [entries])

  const setSite = (id: number | null) => {
    setBefore(null)
    setSiteValue(id)
  }

  const refresh = () => {
    if (before) setBefore(null)
    else void refetch()
  }

  return {
    site,
    setSite,
    entries,
    days,
    keepDays: page?.data.keepDays ?? 400,
    busy: isFetching,
    error: error ? errorMessage(error) : null,
    hasMore: !!next,
    loadMore: () => next && setBefore(next),
    refresh,
  }
}
