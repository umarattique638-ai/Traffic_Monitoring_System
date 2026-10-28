import { useAppSelector } from '../redux'

// The logged-in user and the auth status, from the Redux store.
export function useAuth() {
  const { user, status } = useAppSelector((s) => s.auth)
  return {
    user,
    status,
    isAuthenticated: status === 'authenticated',
    isSuperAdmin: user?.role === 'super_admin',
  }
}
