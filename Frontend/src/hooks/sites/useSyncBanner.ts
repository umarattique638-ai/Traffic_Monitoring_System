import { useSyncAllMutation } from '../../features/sites/sitesApi'
import { notify } from '../../utils/notify'
import { useSites } from './useSites'

/** Sites whose change has not reached the collector yet, and "Retry now". */
export function useSyncBanner() {
  const { kvIssues } = useSites()
  const [syncAll, { isLoading: busy }] = useSyncAllMutation()

  const retry = async () => {
    try {
      await syncAll().unwrap()
    } catch (e) {
      notify.error(e, 'Retry failed.')
    }
  }

  return { kvIssues, retry, busy }
}
