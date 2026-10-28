import { useCallback, useEffect } from 'react'
import { sitesApi, useCheckHealthMutation, useSiteHealthQuery } from '../../features/sites/sitesApi'
import type { Site, SiteHealth } from '../../types/tailwatch'
import { notify } from '../../utils/notify'
import { useAppDispatch } from '../redux'

/** The server re-checks at most hourly; asking every 5 minutes keeps an open tab close to it. */
const HEALTH_EVERY_MS = 5 * 60_000

/**
 * Is the site still sending data? Loaded with the dashboard and every few minutes while the tab is visible;
 * "Check again" asks the server to open the site now. The sidebar's dot follows along.
 */
export function useSiteHealth(site: Site) {
  const dispatch = useAppDispatch()
  const { currentData } = useSiteHealthQuery(site.id, {
    pollingInterval: HEALTH_EVERY_MS,
    skipPollingIfUnfocused: true,
  })
  const [check, { isLoading: checking }] = useCheckHealthMutation()
  const health = currentData?.data.health ?? null

  // Keep the dot in the cached site list in step with the latest answer.
  const status = health?.status
  useEffect(() => {
    if (!status) return
    dispatch(
      sitesApi.util.updateQueryData('listSites', undefined, (draft) => {
        const s = draft.data.sites.find((x) => x.id === site.id)
        if (s && s.health !== status) s.health = status
      }),
    )
  }, [dispatch, site.id, status])

  const show = useCallback(
    (h: SiteHealth) =>
      dispatch(
        sitesApi.util.upsertQueryData('siteHealth', site.id, { success: true, message: 'OK', data: { health: h } }),
      ),
    [dispatch, site.id],
  )

  const checkAgain = useCallback(async () => {
    try {
      const { data } = await check(site.id).unwrap()
      show(data.health)
      if (data.health.status === 'broken')
        notify.warning('Still not working', { description: data.health.reason ?? undefined })
      else if (data.health.status === 'quiet')
        notify.success('The script is installed correctly', {
          description: 'Visits are counted as soon as someone opens the site.',
        })
      else notify.success('Data is arriving')
    } catch (e) {
      notify.error(e, 'Could not check right now. Try again in a minute.')
    }
  }, [check, site.id, show])

  return { health, checking, checkAgain }
}
