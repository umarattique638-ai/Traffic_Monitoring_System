import { Navigate, useNavigate } from 'react-router-dom'
import { RotateCw } from 'lucide-react'
import CancelSetup from '../../components/onboarding/CancelSetup'
import CheckList from '../../components/onboarding/CheckList'
import VerifyProgress from '../../components/onboarding/VerifyProgress'
import Button from '../../components/ui/Button'
import FormError from '../../components/ui/FormError'
import PageHeader from '../../components/ui/PageHeader'
import PageLoading from '../../components/ui/PageLoading'
import { textLinkCls } from '../../components/ui/TextLink'
import { inputCls, muted } from '../../components/ui/styles'
import { useDocumentTitle } from '../../hooks/common/useDocumentTitle'
import { useVerifyPage } from '../../hooks/setup/useVerifyPage'

/**
 * Setup step 3: the server checks the page step by step. When every step passes the site is saved and the
 * dashboard opens by itself.
 */
function Verify() {
  useDocumentTitle('Check the install')
  const navigate = useNavigate()
  const { held, loading, check, label, otherPage, showOtherPage } = useVerifyPage()

  if (loading) return <PageLoading />
  if (!held) return <Navigate to='/sites/new' replace />

  return (
    <>
      <PageHeader
        compact
        title='Check the install'
        description={
          <>
            We open <b className='text-slate-700'>{held.domain}</b> like a visitor would, step by step, and stop at the
            first problem. Our own visits never count in your stats.
          </>
        }
      />

      <VerifyProgress label={label} progress={check.progress} failed={check.failed} />
      <CheckList steps={check.steps} />
      {check.checkError && (
        <div className='mt-4'>
          <FormError message={check.checkError} />
        </div>
      )}

      {(check.failed || otherPage || check.checkError) && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void check.run(check.url)
          }}
          className='mt-6 flex flex-wrap items-end gap-2.5'
        >
          <label className='grid min-w-0 flex-1 basis-64 gap-1.5'>
            <span className='text-sm font-medium text-slate-700'>Page to check</span>
            <input
              className={inputCls}
              value={check.url}
              onChange={(e) => check.setUrl(e.target.value)}
              spellCheck={false}
              inputMode='url'
            />
          </label>
          <Button type='submit' loading={check.running}>
            {!check.running && <RotateCw className='size-4' aria-hidden='true' />} Check again
          </Button>
        </form>
      )}

      {!check.allGood && (
        <p className={`mt-4 text-[13px] leading-relaxed ${muted}`}>
          Nothing is saved until every step is green; then your site joins the dashboard by itself. Fix the first red
          step, publish the change, then check again.{' '}
          {!otherPage && !check.failed && (
            <button type='button' onClick={showOtherPage} className={`${textLinkCls} !font-medium`}>
              Check a different page
            </button>
          )}
        </p>
      )}

      {!check.allGood && (
        <div className='mt-6 flex flex-wrap gap-2.5 border-t border-slate-100 pt-5'>
          <Button variant='secondary' onClick={() => navigate('/install')}>
            Back to the script
          </Button>
          <span className='ml-auto'>
            <CancelSetup domain={held.domain} />
          </span>
        </div>
      )}
    </>
  )
}

export default Verify
