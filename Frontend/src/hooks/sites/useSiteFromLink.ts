import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSites } from './useSites'

/** A link from an e-mail (/dashboard?site=1001) opens that site, once the list is loaded. */
export function useSiteFromLink() {
  const [params] = useSearchParams()
  const { sites, select } = useSites()
  const linked = Number(params.get('site'))

  useEffect(() => {
    if (linked && sites.some((s) => s.id === linked)) select(linked)
  }, [linked, sites, select])
}
