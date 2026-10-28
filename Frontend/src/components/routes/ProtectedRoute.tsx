import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/auth/useAuth'
import type { Role } from '../../types/api'
import FullScreenLoader from './FullScreenLoader'

// Sirf login user (aur agar role diya ho to sirf us role wala) andar ja sakta hai.
function ProtectedRoute({ role }: { role?: Role }) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'checking') return <FullScreenLoader />
  if (status === 'guest') return <Navigate to='/login' replace state={{ from: location.pathname }} />
  if (role && user?.role !== role) return <Navigate to='/dashboard' replace />
  return <Outlet />
}

export default ProtectedRoute
