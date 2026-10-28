import { Outlet } from 'react-router-dom'
import AuthHero from '../common/AuthHero'

function AuthLayout() {
  return (
    <div className='flex min-h-screen bg-[#f7f9fb]'>
      <AuthHero />

      <main
        className='flex flex-1 flex-col items-center justify-center gap-8 px-4 py-10'
        style={{
          backgroundImage: 'radial-gradient(ellipse at top, rgba(45,212,191,0.12), transparent 60%)',
        }}
      >
        <Outlet />
        <p className='text-xs text-gray-400'>© 2026 TailWatch</p>
      </main>
    </div>
  )
}

export default AuthLayout
