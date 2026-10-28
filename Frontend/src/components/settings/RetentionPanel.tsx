import { Clock3 } from 'lucide-react'
import ConfirmDialog from '../ui/ConfirmDialog'
import Panel from '../ui/Panel'
import SegmentedControl from '../ui/SegmentedControl'
import type { Site } from '../../types/tailwatch'
import { retentionLabel, useRetention } from '../../hooks/sites/useRetention'

/** How long each site keeps its analytics. Shortening asks first: older data is deleted. */
export default function RetentionPanel({ sites, choices }: { sites: Site[]; choices: number[] }) {
  const r = useRetention()
  const options = choices.map((d) => ({ value: String(d), label: retentionLabel(d) }))

  return (
    <Panel
      title='Data retention'
      subtitle='How long each site keeps its analytics. Older data is deleted automatically, in weekly batches.'
    >
      {sites.length === 0 ? (
        <p className='text-sm text-slate-500 dark:text-slate-400'>Add a site first.</p>
      ) : (
        <ul className='grid gap-3' data-testid='retention-list'>
          {sites.map((site) => (
            <li
              key={site.id}
              className='flex min-w-0 flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center dark:border-slate-800'
            >
              <div className='flex min-w-0 flex-1 items-center gap-3'>
                <span className='grid size-9 flex-none place-items-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300'>
                  <Clock3 className='size-[18px]' aria-hidden='true' />
                </span>
                <div className='min-w-0'>
                  <p className='truncate font-semibold text-slate-900 dark:text-white'>{site.domain}</p>
                  <p className='text-xs text-slate-500 dark:text-slate-400'>
                    Keeps {retentionLabel(site.retentionDays)}
                  </p>
                </div>
              </div>
              <SegmentedControl
                label={`Retention of ${site.domain}`}
                value={String(site.retentionDays)}
                options={options}
                disabled={r.busySite === site.id}
                onChange={(v) => r.choose(site, Number(v))}
              />
            </li>
          ))}
        </ul>
      )}
      <p className='mt-4 text-[13px] text-slate-500 dark:text-slate-400'>
        A deleted site keeps its data for its retention too, so adding it again brings the history back.
      </p>
      {r.pending && (
        <ConfirmDialog
          title={`Keep ${retentionLabel(r.pending.days)} for ${r.pending.site.domain}?`}
          confirmLabel='Shorten retention'
          busyLabel='Saving…'
          busy={r.busySite !== null}
          onCancel={r.cancel}
          onConfirm={r.confirm}
          message={`Data older than ${retentionLabel(r.pending.days)} is deleted within a week and cannot be brought back. Download your data first if you want a copy.`}
        />
      )}
    </Panel>
  )
}
