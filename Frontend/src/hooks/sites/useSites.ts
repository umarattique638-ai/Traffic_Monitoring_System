import { useCallback } from 'react'
import { useListSitesQuery } from '../../features/sites/sitesApi'
import { selectSite } from '../../features/sites/siteSlice'
import { useAppDispatch, useAppSelector } from '../redux'

/** Polls the list every minute while a change has not reached Cloudflare yet (the server retries on it). */
const KV_RETRY_MS = 60_000

/**
 * The user's sites and the one being looked at. Only verified sites are shown (a site is saved only after its
 * install check passes); `current` falls back to the first site when the remembered one is gone.
 */
export function useSites() {
  const dispatch = useAppDispatch()
  const selectedId = useAppSelector((s) => s.site.selectedId)
  const { data, isLoading, error, refetch } = useListSitesQuery()
  const kvIssues = data?.data.kvIssues ?? []

  // A second subscription that only polls while something is pending.
  useListSitesQuery(undefined, { pollingInterval: kvIssues.length ? KV_RETRY_MS : 0, skipPollingIfUnfocused: true })

  const allSites = data?.data.sites ?? []
  const sites = allSites.filter((s) => !!s.verifiedAt)
  const current = sites.find((s) => s.id === selectedId) ?? sites[0] ?? null

  const select = useCallback((id: number | null) => dispatch(selectSite(id)), [dispatch])

  return { sites, allSites, kvIssues, current, select, isLoading, error, refetch }
}
