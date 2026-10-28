import { useState } from 'react'
import {
  reportDownloadPath,
  useCreateReportMutation,
  useDeleteReportMutation,
  useListReportsQuery,
} from '../../features/reports/reportsApi'
import type { RangeKey, Report } from '../../types/tailwatch'
import { errorMessage } from '../../utils/apiError'
import { downloadFile } from '../../utils/download'
import { notify } from '../../utils/notify'

/** Saved CSV reports of a site: list, make (and download), download again, delete. */
export function useReports(siteId: number) {
  const { currentData, error, refetch } = useListReportsQuery(siteId)
  const [createReport, { isLoading: creating }] = useCreateReportMutation()
  const [deleteReport, { isLoading: deleting }] = useDeleteReportMutation()
  const [fresh, setFresh] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<Report | null>(null)

  const download = async (report: Report) => {
    try {
      await downloadFile(reportDownloadPath(siteId, report.id), report.filename)
    } catch (e) {
      notify.error(e, 'The download failed.')
    }
  }

  const create = async (range: RangeKey) => {
    if (creating) return
    try {
      const { data } = await createReport({ siteId, range }).unwrap()
      setFresh(data.export.id)
      await downloadFile(reportDownloadPath(siteId, data.export.id), data.export.filename)
      notify.success('Report saved and downloading', { description: data.export.filename })
    } catch (e) {
      notify.error(e, 'The report could not be made.')
    }
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    try {
      await deleteReport({ siteId, reportId: toDelete.id }).unwrap()
      notify.success('Report deleted', { description: toDelete.filename })
    } catch (e) {
      notify.error(e, 'The report could not be deleted.')
    } finally {
      setToDelete(null)
    }
  }

  return {
    list: currentData?.data.exports ?? null,
    keepDays: currentData?.data.keepDays ?? 90,
    max: currentData?.data.max ?? 200,
    loadError: error ? errorMessage(error) : null,
    reload: refetch,
    create,
    creating,
    download,
    fresh,
    toDelete,
    askDelete: setToDelete,
    cancelDelete: () => setToDelete(null),
    confirmDelete,
    deleting,
  }
}
