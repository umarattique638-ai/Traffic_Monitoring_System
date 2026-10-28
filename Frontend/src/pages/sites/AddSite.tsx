import Button from '../../components/ui/Button'
import Field from '../../components/ui/Field'
import FormError from '../../components/ui/FormError'
import PageHeader from '../../components/ui/PageHeader'
import Select from '../../components/ui/Select'
import { muted } from '../../components/ui/styles'
import { useDocumentTitle } from '../../hooks/common/useDocumentTitle'
import { useAddSite } from '../../hooks/setup/useAddSite'

/** Setup step 1: the domain and its timezone. */
function AddSite() {
  useDocumentTitle('Add your site')
  const form = useAddSite()

  return (
    <>
      <PageHeader
        compact
        title='Add your site'
        description='Enter your domain. Nothing changes on your DNS or hosting, and nothing is saved until your install is verified.'
      />
      <form
        className='grid w-full gap-6'
        onSubmit={(e) => {
          e.preventDefault()
          void form.submit()
        }}
      >
        <Field
          label='Domain'
          name='domain'
          placeholder='example.com'
          spellCheck={false}
          autoCapitalize='none'
          autoComplete='off'
          value={form.domain}
          onChange={(e) => form.setDomain(e.target.value)}
          required
          autoFocus
        />

        <Select
          label='Timezone'
          name='timezone'
          value={form.timezone}
          onChange={form.setTimezone}
          options={form.zones.list}
          hint='Daily reports split at midnight in this timezone. Type to search, e.g. karachi.'
        />

        <div className='rounded-xl border border-dashed border-slate-300 p-4'>
          <p className='text-sm font-medium text-slate-700'>Hosts we'll accept</p>
          <div className='mt-2 flex flex-wrap gap-2' aria-live='polite'>
            {form.hosts ? (
              form.hosts.map((h) => (
                <span
                  key={h}
                  className='rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[13px] text-slate-800'
                >
                  {h}
                </span>
              ))
            ) : (
              <span className={`text-[13px] ${muted}`}>Your domain and all its subdomains, www included.</span>
            )}
          </div>
        </div>

        <FormError message={form.error} />
        <Button type='submit' className='w-full' loading={form.busy}>
          Add site
        </Button>
      </form>
    </>
  )
}

export default AddSite
