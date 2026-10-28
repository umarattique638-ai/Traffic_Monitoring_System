import { useState } from 'react'
import { useUpdateSiteMutation } from '../../features/sites/sitesApi'
import type { Site } from '../../types/tailwatch'
import { notify } from '../../utils/notify'

/** 30 -> "30 days", 180 -> "6 months", 395 -> "13 months". */
export const retentionLabel = (days: number) =>
  days === 395 ? '13 months' : days === 180 ? '6 months' : days === 365 ? '12 months' : `${days} days`

/**
 * Retention per site. Lengthening saves at once; shortening deletes data, so it waits for a confirmation
 * (`pending`) first.
 */
export function useRetention() {
  const [update] = useUpdateSiteMutation()
  const [busySite, setBusySite] = useState<number | null>(null)
  const [pending, setPending] = useState<{ site: Site; days: number } | null>(null)

  const save = async (site: Site, days: number) => {
    setBusySite(site.id)
    try {
      await update({ id: site.id, patch: { retentionDays: days } }).unwrap()
      notify.success(
        days < site.retentionDays
          ? `${site.domain} now keeps ${retentionLabel(days)}. Older data is deleted within a week.`
          : `${site.domain} now keeps ${retentionLabel(days)}.`,
      )
    } catch (e) {
      notify.error(e, 'Could not save.')
    } finally {
      setPending(null)
      setBusySite(null)
    }
  }

  const choose = (site: Site, days: number) => {
    if (days === site.retentionDays) return
    if (days < site.retentionDays) setPending({ site, days })
    else void save(site, days)
  }

  return {
    choose,
    pending,
    confirm: () => pending && save(pending.site, pending.days),
    cancel: () => setPending(null),
    busySite,
  }
}
