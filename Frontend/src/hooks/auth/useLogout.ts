import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useLogoutMutation } from '../../features/auth/authApi'

// Logout on this device. Even if the server cannot be reached, the user is sent to the login page
// (authApi already cleared the store).
export function useLogout() {
  const navigate = useNavigate()
  const [logout, { isLoading }] = useLogoutMutation()

  const onLogout = async () => {
    try {
      await logout().unwrap()
      toast.success('Logged out.')
    } catch {
      // Ignored on purpose: logout never fails for the user.
    }
    navigate('/login', { replace: true })
  }

  return { onLogout, isLoading }
}
