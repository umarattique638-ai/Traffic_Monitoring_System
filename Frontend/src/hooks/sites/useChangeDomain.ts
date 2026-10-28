import { useState } from 'react'
import { useChangeDomainMutation } from '../../features/sites/sitesApi'
import type { Check, Site } from '../../types/tailwatch'
import { errorMessage } from '../../utils/apiError'
import { notify } from '../../utils/notify'

/**
 * The site moved (shop.com -> shop.pk). The same script with the same key must already be on the new domain;
 * the server checks it there and only then switches. History, key and settings stay.
 */
export function useChangeDomain(site: Site, suggested: string | null | undefined, onDone: () => void) {
  const [change, { isLoading: busy }] = useChangeDomainMutation()
  const [domain, setDomain] = useState(suggested ?? '')
  const [error, setError] = useState<string | null>(null)
  const [checks, setChecks] = useState<Check[] | null>(null)

  const submit = async () => {
    if (!domain.trim() || busy) return
    setError(null)
    setChecks(null)
    try {
      const { data } = await change({ id: site.id, domain }).unwrap()
      if (data.ok && data.site) {
        notify.success(`The site is now ${data.site.domain}`, {
          description: `Its history is kept. Visits from ${site.domain} no longer count.`,
        })
        onDone()
        return
      }
      setChecks(data.checks)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return { domain, setDomain, submit, busy, error, checks }
}
