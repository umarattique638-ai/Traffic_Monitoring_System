import { LogOut } from 'lucide-react'
import Button from '../ui/Button'
import Panel from '../ui/Panel'
import { useLogoutAll } from '../../hooks/auth/useLogoutAll'

/** Log out everywhere: every phone, laptop and browser where this account is logged in. */
export default function SecurityPanel() {
  const { onLogoutAll, isLoading } = useLogoutAll()
  return (
    <Panel title='Security' subtitle='Log out on every phone, laptop and browser where you are logged in.'>
      <Button variant='dangerOutline' onClick={onLogoutAll} loading={isLoading}>
        {!isLoading && <LogOut className='size-4' aria-hidden='true' />}
        {isLoading ? 'Please wait…' : 'Logout from all devices'}
      </Button>
    </Panel>
  )
}
