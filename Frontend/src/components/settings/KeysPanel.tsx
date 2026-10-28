import { KeyRound, Plus } from 'lucide-react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import ConfirmDialog from '../ui/ConfirmDialog'
import Panel from '../ui/Panel'
import { useSiteKeys } from '../../hooks/sites/useSiteKeys'
import type { Site } from '../../types/tailwatch'

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** One site's keys: add a new key, then revoke the old one once the new snippet is on the site. */
function SiteKeys({ site }: { site: Site }) {
  const k = useSiteKeys(site)

  return (
    <li className='rounded-xl border border-slate-200 p-4'>
      <div className='flex flex-wrap items-center gap-3'>
        <span className='grid size-9 flex-none place-items-center rounded-lg bg-teal-50 text-teal-700'>
          <KeyRound className='size-[18px]' aria-hidden='true' />
        </span>
        <div className='min-w-0 flex-1'>
          <p className='truncate font-semibold text-slate-900'>{site.domain}</p>
          <p className='text-xs text-slate-500'>
            {k.active.length} active key{k.active.length === 1 ? '' : 's'}
          </p>
        </div>
        <Button variant='secondary' size='sm' className='h-9' onClick={k.addKey} loading={k.creating}>
          {!k.creating && <Plus className='size-4' aria-hidden='true' />} New key
        </Button>
      </div>

      <ul className='mt-3 grid gap-2'>
        {site.keys.map((key) => (
          <li key={key.id} className='flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-2'>
            <code className='min-w-0 flex-1 truncate font-mono text-[13px] text-slate-800'>{key.publicKey}</code>
            <Badge tone={key.status === 'active' ? 'emerald' : 'neutral'}>
              {key.status === 'active' ? 'Active' : 'Revoked'}
            </Badge>
            <span className='text-xs text-slate-500'>
              {key.status === 'active'
                ? `Added ${dateFmt.format(new Date(key.createdAt))}`
                : `Revoked ${dateFmt.format(new Date(key.revokedAt ?? key.createdAt))}`}
            </span>
            {key.status === 'active' && (
              <button
                type='button'
                onClick={() => k.askRevoke(key)}
                disabled={k.active.length < 2}
                title={k.active.length < 2 ? 'Add a new key first: a site always needs one active key.' : undefined}
                className='cursor-pointer text-xs font-semibold text-rose-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline'
              >
                Revoke
              </button>
            )}
          </li>
        ))}
      </ul>

      {k.toRevoke && (
        <ConfirmDialog
          title='Revoke this key?'
          confirmLabel='Revoke key'
          busyLabel='Revoking…'
          busy={k.revoking}
          onCancel={k.cancelRevoke}
          onConfirm={k.confirmRevoke}
          message={
            <>
              Hits sent with <code className='font-mono text-[13px]'>{k.toRevoke.publicKey}</code> stop counting within
              a minute. Make sure the new snippet is on {site.domain} first.
            </>
          }
        />
      )}
    </li>
  )
}

/** Site keys (the id in the snippet). Rotate one when it was copied somewhere it should not be. */
export default function KeysPanel({ sites }: { sites: Site[] }) {
  return (
    <Panel title='Site keys' subtitle='The key in your snippet. Rotate it if someone sends fake hits with it.'>
      {sites.length === 0 ? (
        <p className='text-sm text-slate-500'>Add a site first.</p>
      ) : (
        <ul className='grid gap-3'>
          {sites.map((s) => (
            <SiteKeys key={s.id} site={s} />
          ))}
        </ul>
      )}
    </Panel>
  )
}
