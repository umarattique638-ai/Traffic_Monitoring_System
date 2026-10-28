import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Setup } from '../../types/tailwatch'
import { notify } from '../../utils/notify'
import { useSites } from '../sites/useSites'
import { useInstallCheck } from './useInstallCheck'
import { useSetup } from './useSetup'

/**
 * Setup step 3. The setup is kept here after the site is saved (the server forgets the setup then), until the
 * dashboard opens with the new site selected.
 */
export function useVerifyPage() {
  const navigate = useNavigate()
  const { setup, isLoading } = useSetup()
  const { select } = useSites()
  const [held, setHeld] = useState<Setup | null>(setup)
  const [otherPage, setOtherPage] = useState(false)

  // A (new) setup from the server replaces the held one; when the server forgets it, the held one stays.
  if (setup && setup !== held) setHeld(setup)

  const check = useInstallCheck(held, (site) => {
    select(site.id)
    notify.success(`${site.domain} added`, {
      description: 'Every check passed. Visits show up on your dashboard from now on.',
    })
    navigate('/dashboard', { replace: true })
  })

  const label = check.allGood
    ? 'All checks passed: opening your dashboard…'
    : check.running
      ? 'Checking your site…'
      : check.failed
        ? `Stopped at step ${check.stoppedAt} of ${check.total}: fix it, then check again`
        : `${check.done} of ${check.total} checks done`

  return { held, loading: isLoading && !held, check, label, otherPage, showOtherPage: () => setOtherPage(true) }
}
