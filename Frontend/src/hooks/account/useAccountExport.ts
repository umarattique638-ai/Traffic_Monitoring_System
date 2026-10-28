import { useState } from 'react'
import { downloadFile } from '../../utils/download'
import { notify } from '../../utils/notify'
import { useAction } from '../common/useAction'

/** "Download all data": the account and every site's settings, reports and activity, as one JSON file. */
export function useAccountExport() {
  const [done, setDone] = useState(false)
  const { run, busy } = useAction(async () => {
    setDone(false)
    try {
      await downloadFile('/account/export', 'tailwatch-export.json')
      setDone(true)
      notify.success('Downloaded. Keep the file somewhere safe.')
    } catch (e) {
      notify.error(e, 'The download failed.')
    }
  })
  return { download: run, busy, done }
}
