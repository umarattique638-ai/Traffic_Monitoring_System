import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import VerifyEmail from './pages/auth/VerifyEmail'
import Forgotpassword from './pages/auth/Forgotpassword'
import OtpVrification from './pages/auth/OtpVrification'
import ResetPassword from './pages/auth/ResetPassword'
import Mainlayout from './components/Layout/Mainlayout'
import SetupLayout from './components/Layout/SetupLayout'
import Users from './pages/admin/Users'
import AuthLayout from './components/Layout/AuthLayout'
import GuestRoute from './components/routes/GuestRoute'
import ProtectedRoute from './components/routes/ProtectedRoute'
import { useMeQuery } from './features/auth/authApi'

// Traffic pages load on demand (charts are heavy); the auth pages stay in the first bundle.
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'))
const Events = lazy(() => import('./pages/dashboard/Events'))
const SuspiciousActivity = lazy(() => import('./pages/dashboard/SuspiciousActivity'))
const Reports = lazy(() => import('./pages/dashboard/Reports'))
const AuditActivity = lazy(() => import('./pages/dashboard/AuditActivity'))
const Settings = lazy(() => import('./pages/dashboard/Settings'))
const AddSite = lazy(() => import('./pages/sites/AddSite'))
const Install = lazy(() => import('./pages/sites/Install'))
const Verify = lazy(() => import('./pages/sites/Verify'))

function App() {
  // App khulte hi backend se poocho: kaun login hai?
  useMeQuery()

  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route element={<AuthLayout />}>
          <Route path='/login' element={<Login />} />
          <Route path='/signup' element={<Signup />} />
          <Route path='/forgot-password' element={<Forgotpassword />} />
          <Route path='/otp-verification' element={<OtpVrification />} />
          <Route path='/reset-password' element={<ResetPassword />} />
        </Route>
      </Route>

      <Route element={<AuthLayout />}>
        <Route path='/verify-email' element={<VerifyEmail />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<Mainlayout />}>
          <Route path='/dashboard' element={<Dashboard />} />
          <Route path='/suspicious-activity' element={<SuspiciousActivity />} />
          <Route path='/events' element={<Events />} />
          <Route path='/reports' element={<Reports />} />
          <Route path='/activity' element={<AuditActivity />} />
          <Route path='/settings' element={<Settings />} />

          {/* Adding a site: domain -> script -> install check */}
          <Route element={<SetupLayout />}>
            <Route path='/sites/new' element={<AddSite />} />
            <Route path='/install' element={<Install />} />
            <Route path='/verify' element={<Verify />} />
          </Route>

          <Route element={<ProtectedRoute role='super_admin' />}>
            <Route path='/admin/users' element={<Users />} />
          </Route>
        </Route>
      </Route>

      <Route path='*' element={<Navigate to='/dashboard' replace />} />
    </Routes>
  )
}

export default App
