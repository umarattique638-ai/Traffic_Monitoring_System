import { Trash2 } from 'lucide-react'
import Button from '../ui/Button'
import ConfirmDialog from '../ui/ConfirmDialog'
import Notice from '../ui/Notice'
import { useCancelSetup } from '../../hooks/setup/useCancelSetup'

/**
 * Stops the setup in progress (a typo, or the customer gives up). Nothing was saved for it, so there is
 * nothing to delete: its key simply stops working.
 */
export default function CancelSetup({ domain }: { domain: string }) {
  const c = useCancelSetup(domain)

  return (
    <>
      <Button variant='ghost' className='text-slate-500 hover:text-rose-600 dark:hover:text-rose-300' onClick={c.ask}>
        <Trash2 className='size-4' aria-hidden='true' /> Cancel setup
      </Button>
      {c.asking && (
        <ConfirmDialog
          title={`Cancel setting up ${domain}?`}
          confirmLabel='Cancel setup'
          busyLabel='Cancelling…'
          busy={c.busy}
          onCancel={c.close}
          onConfirm={() => c.confirm()}
          message={
            <>
              <p>
                Nothing was saved for {domain}: it is saved only once every check passes. Cancelling stops its script
                key; remove the script from your site too.
              </p>
              {c.error && (
                <Notice tone='error' className='mt-3'>
                  {c.error}
                </Notice>
              )}
            </>
          }
        />
      )}
    </>
  )
}
