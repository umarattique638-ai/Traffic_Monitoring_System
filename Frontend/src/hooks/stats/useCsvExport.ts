import { useNavigate } from 'react-router-dom'
import { reportDownloadPath, useCreateReportMutation } from '../../features/reports/reportsApi'
import type { RangeKey } from '../../types/tailwatch'
import { downloadFile } from '../../utils/download'
import { notify } from '../../utils/notify'
import { useAction } from '../common/useAction'

/** "Export CSV" on the dashboard: the report is saved (Reports page, kept 90 days) and downloaded at once. */
export function useCsvExport(siteId: number, range: RangeKey) {
  const navigate = useNavigate()
  const [create] = useCreateReportMutation()

  const { run, busy } = useAction(async () => {
    try {
      const { data } = await create({ siteId, range }).unwrap()
      await downloadFile(reportDownloadPath(siteId, data.export.id), data.export.filename)
      notify.success('CSV downloaded', {
        description: 'A copy is saved in Reports.',
        action: { label: 'Open', onClick: () => navigate('/reports') },
      })
    } catch (e) {
      notify.error(e, 'Export failed.')
    }
  })

  return { exportCsv: run, busy }
}
