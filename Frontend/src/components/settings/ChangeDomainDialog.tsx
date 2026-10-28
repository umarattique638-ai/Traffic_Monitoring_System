import Button from '../ui/Button'
import Modal from '../ui/Modal'
import Notice from '../ui/Notice'
import CheckList from '../onboarding/CheckList'
import type { Step } from '../onboarding/CheckList'
import { inputCls, muted } from '../ui/styles'
import type { Site } from '../../types/tailwatch'
import { useChangeDomain } from '../../hooks/sites/useChangeDomain'

/**
 * The site moved (shop.com -> shop.pk). The same script with the same key must already be on the
 * new domain; the server checks it there, and only then switches. History, key and settings stay.
 */
export default function ChangeDomainDialog({
  site,
  suggested,
  onClose,
}: {
  site: Site
  suggested?: string | null
  onClose: () => void
}) {
  const { domain, setDomain, submit, busy, error, checks } = useChangeDomain(site, suggested, onClose)

  // Up to the step that failed; the ones after it were not checked.
  const failedAt = checks ? checks.findIndex((c) => c.status === 'fail') : -1
  const steps: Step[] = (checks ?? [])
    .slice(0, failedAt + 1)
    .map((c) => ({ id: c.id, label: c.label, state: c.status, message: c.message }))

  return (
    <Modal
      wide
      title={`Change the domain of ${site.domain}`}
      onClose={onClose}
      locked={busy}
      footer={
        <>
          <Button variant='secondary' size='sm' className='h-10 px-4' onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button size='sm' className='h-10 px-4' onClick={submit} loading={busy} disabled={!domain.trim()}>
            {busy ? 'Checking…' : 'Check and change'}
          </Button>
        </>
      }
    >
      <p>
        Moved your site to a new address? Put the <b>same script</b> on the new domain first (it is already there if you
        only moved the site). We check it there, then switch. The history, the site key and your settings stay.
      </p>
      <form
        className='mt-4 grid gap-1.5'
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <label htmlFor='new-domain' className='text-sm font-medium text-slate-700 dark:text-slate-200'>
          New domain
        </label>
        <input
          id='new-domain'
          className={inputCls}
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder='shop.example.pk'
          spellCheck={false}
          autoCapitalize='none'
          autoComplete='off'
          disabled={busy}
          data-autofocus
        />
        <span className={`text-[13px] ${muted}`}>
          After the change, only this domain and its subdomains count. Visits to {site.domain} no longer do.
        </span>
      </form>
      {error && (
        <Notice tone='error' className='mt-4'>
          {error}
        </Notice>
      )}
      {checks && steps.length > 0 && (
        <div className='mt-5' data-testid='domain-checks'>
          <p className='mb-3 text-sm font-medium text-slate-700 dark:text-slate-200'>
            Nothing was changed. Fix this on the new domain, then try again:
          </p>
          <CheckList steps={steps} />
        </div>
      )}
    </Modal>
  )
}
