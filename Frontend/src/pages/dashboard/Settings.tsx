import DeleteAccountPanel from '../../components/settings/DeleteAccountPanel'
import DomainPanel from '../../components/settings/DomainPanel'
import ExportPanel from '../../components/settings/ExportPanel'
import KeysPanel from '../../components/settings/KeysPanel'
import RetentionPanel from '../../components/settings/RetentionPanel'
import SecurityPanel from '../../components/settings/SecurityPanel'
import PageHeader from '../../components/ui/PageHeader'
import { useRetentionChoices } from '../../hooks/account/useAccountProfile'
import { useAuth } from '../../hooks/auth/useAuth'
import { useDocumentTitle } from '../../hooks/common/useDocumentTitle'
import { useSites } from '../../hooks/sites/useSites'

function Settings() {
  useDocumentTitle('Settings')
  const { user } = useAuth()
  const { sites, allSites } = useSites()
  const retention = useRetentionChoices()

  return (
    <div className='grid gap-6'>
      <PageHeader title='Settings' description={`Signed in as ${user?.email ?? ''}`} />
      <DomainPanel sites={sites} />
      <KeysPanel sites={sites} />
      <RetentionPanel sites={sites} choices={retention.choices} />
      <SecurityPanel />
      <ExportPanel />
      <DeleteAccountPanel siteCount={allSites.length} />
    </div>
  )
}

export default Settings
