import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePreviewDomainQuery } from '../../features/sites/sitesApi'
import { useStartSetupMutation } from '../../features/setup/setupApi'
import { timezoneOptions } from '../../utils/timezones'
import { notify } from '../../utils/notify'
import { useAction } from '../common/useAction'
import { useDebouncedValue } from '../common/useDebouncedValue'

/**
 * Setup step 1, "Add your site": the domain, the timezone, and the hosts the API will accept for that domain
 * (asked from the API while typing: the rule lives there). Submitting starts a SETUP, not a site.
 */
export function useAddSite() {
  const navigate = useNavigate()
  const zones = useMemo(() => timezoneOptions(), [])
  const [domain, setDomain] = useState('')
  const [timezone, setTimezone] = useState(zones.local)
  const typed = useDebouncedValue(domain.trim(), 300)
  const preview = usePreviewDomainQuery(typed, { skip: !typed })
  const [start] = useStartSetupMutation()

  const { run, busy, error } = useAction(async () => {
    const { data } = await start({ domain, timezone }).unwrap()
    notify.info(data.resumed ? `Continuing with ${data.setup.domain}` : `Setting up ${data.setup.domain}`, {
      description:
        'Nothing is saved yet. Paste the script on your site and verify: it is saved once every check passes.',
    })
    navigate('/install')
  }, 'Could not add the site.')

  const hosts = typed && !preview.isError ? (preview.currentData?.data.allowedHosts ?? null) : null
  return { zones, domain, setDomain, timezone, setTimezone, hosts, submit: run, busy, error }
}
