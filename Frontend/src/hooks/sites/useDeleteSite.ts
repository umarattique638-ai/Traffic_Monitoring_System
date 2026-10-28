import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDeleteSiteMutation } from '../../features/sites/sitesApi'
import type { Site } from '../../types/tailwatch'
import { errorMessage } from '../../utils/apiError'
import { notify } from '../../utils/notify'
import { useSites } from './useSites'

/**
 * Deleting a site from the sidebar, keeping its data or erasing it too. When the deleted site was the one
 * shown, the next site is selected, or "Add a site" opens when none is left.
 */
export function useDeleteSite() {
  const navigate = useNavigate()
  const { sites, current, select } = useSites()
  const [remove, { isLoading: busy }] = useDeleteSiteMutation()
  const [target, setTarget] = useState<Site | null>(null)
  const [error, setError] = useState<string | null>(null)

  const confirm = async (eraseData: boolean) => {
    if (!target) return
    setError(null)
    try {
      await remove({ id: target.id, eraseData }).unwrap()
    } catch (e) {
      setError(errorMessage(e))
      return
    }
    notify.success(eraseData ? `${target.domain} and its data deleted` : `${target.domain} deleted`, {
      description: eraseData
        ? 'Everything collected for it is being erased. It cannot be brought back.'
        : 'It no longer collects. Adding it again brings the data back.',
    })
    const remaining = sites.filter((s) => s.id !== target.id)
    if (current?.id === target.id) {
      if (remaining.length) select(remaining[0]!.id)
      else navigate('/sites/new')
    }
    setTarget(null)
  }

  return {
    target,
    ask: (site: Site) => {
      setError(null)
      setTarget(site)
    },
    cancel: () => setTarget(null),
    confirm,
    busy,
    error,
  }
}
