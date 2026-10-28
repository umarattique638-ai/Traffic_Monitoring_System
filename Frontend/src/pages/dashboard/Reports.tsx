import NoSiteYet from '../../components/dashboard/NoSiteYet'
import NewReport from '../../components/reports/NewReport'
import SavedReports from '../../components/reports/SavedReports'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import PageHeader from '../../components/ui/PageHeader'
import { useDocumentTitle } from '../../hooks/common/useDocumentTitle'
import { useReports } from '../../hooks/reports/useReports'
import { useCurrentSite } from '../../hooks/sites/useCurrentSite'
import type { Site } from '../../types/tailwatch'

function Reports() {
  useDocumentTitle('Reports')
  const current = useCurrentSite()
  if (!current) return <NoSiteYet />
  return <SiteReports site={current} />
}

function SiteReports({ site }: { site: Site }) {
  const r = useReports(site.id)

  return (
    <div className='grid gap-6'>
      <PageHeader
        title='Reports'
        description={`Download your numbers as CSV. Every report is saved here for ${r.keepDays} days.`}
      />
      <NewReport timezone={site.timezone} creating={r.creating} onCreate={r.create} />
      <SavedReports
        list={r.list}
        keepDays={r.keepDays}
        max={r.max}
        loadError={r.loadError}
        fresh={r.fresh}
        onReload={r.reload}
        onDelete={r.askDelete}
        onDownload={r.download}
      />

      {r.toDelete && (
        <ConfirmDialog
          title='Delete this report?'
          confirmLabel='Delete'
          busyLabel='Deleting…'
          busy={r.deleting}
          onCancel={r.cancelDelete}
          onConfirm={r.confirmDelete}
          message={
            <>
              <span className='font-medium text-slate-700'>{r.toDelete.filename}</span> is removed from your saved
              reports. Your analytics data is not touched: you can make the same report again any time.
            </>
          }
        />
      )}
    </div>
  )
}

export default Reports
