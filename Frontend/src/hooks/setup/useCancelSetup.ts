import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCancelSetupMutation } from '../../features/setup/setupApi'
import { notify } from '../../utils/notify'
import { useAction } from '../common/useAction'
import { useSites } from '../sites/useSites'

/**
 * Stops the setup in progress. Nothing was saved for it, so there is nothing to delete: its key simply
 * stops working. Back to the dashboard, or to "Add your site" when there is no site yet.
 */
export function useCancelSetup(domain: string) {
  const navigate = useNavigate()
  const { sites } = useSites()
  const [cancel] = useCancelSetupMutation()
  const [asking, setAsking] = useState(false)

  const { run, busy, error } = useAction(async () => {
    await cancel().unwrap()
    notify.success(`Setup of ${domain} cancelled`)
    navigate(sites.length ? '/dashboard' : '/sites/new')
  }, 'The setup could not be cancelled.')

  return { asking, ask: () => setAsking(true), close: () => setAsking(false), confirm: run, busy, error }
}
