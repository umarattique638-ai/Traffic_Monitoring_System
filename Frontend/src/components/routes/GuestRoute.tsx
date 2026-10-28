import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/auth/useAuth'
import FullScreenLoader from './FullScreenLoader'

// Login, signup jaise pages: jo pehle se login hai usay dashboard bhej do.
function GuestRoute() {
  const { status } = useAuth()

  if (status === 'checking') return <FullScreenLoader />
  if (status === 'authenticated') return <Navigate to='/dashboard' replace />
  return <Outlet />
}

export default GuestRoute
