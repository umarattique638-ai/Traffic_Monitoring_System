import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { errorMessage } from '../../utils/apiError'
import { useLogoutAllMutation } from '../../features/auth/authApi'

// Logout on every device; shows how many sessions ended.
export function useLogoutAll() {
  const navigate = useNavigate()
  const [logoutAll, { isLoading }] = useLogoutAllMutation()

  const onLogoutAll = async () => {
    try {
      const res = await logoutAll().unwrap()
      toast.success(`${res.message} (${res.data.sessionsEnded})`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
    navigate('/login', { replace: true })
  }

  return { onLogoutAll, isLoading }
}
