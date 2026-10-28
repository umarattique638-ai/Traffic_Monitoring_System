import { CiLogout } from 'react-icons/ci'
import { LuX } from 'react-icons/lu'
import logo from '../../assets/lg.png'
import { useAuth } from '../../hooks/auth/useAuth'
import { useLogout } from '../../hooks/auth/useLogout'
import { useSites } from '../../hooks/sites/useSites'
import SidebarCapture from '../sites/SidebarCapture'
import SiteSwitcher from '../sites/SiteSwitcher'
import Navbar from '../ui/Navbar'

const initials = (name: string) =>
  name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('') || '?'

// The sidebar: logo, site switcher, menu, capture rate of the selected site, and the user with Logout.
// On phones it is a drawer (`open`), closed with the X or by tapping outside.
function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, isSuperAdmin } = useAuth()
  const { onLogout, isLoading } = useLogout()
  const { current } = useSites()
  const name = user?.name?.trim() || user?.email || ''

  return (
    <aside
      aria-label='Sidebar'
      className={`fixed inset-y-0 left-0 z-[100] flex w-[17rem] shrink-0 flex-col bg-[#020618] text-white transition-transform duration-200 lg:static lg:translate-x-0 ${
        open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      }`}
    >
      <div className='flex items-center justify-between px-5 pt-5 pb-4'>
        <img className='h-11 w-auto object-contain' src={logo} alt='Tailwatch' draggable={false} />
        <button
          type='button'
          onClick={onClose}
          aria-label='Close menu'
          className='grid size-9 place-items-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white lg:hidden'
        >
          <LuX className='text-xl' />
        </button>
      </div>

      <div className='flex-1 overflow-y-auto px-3 pb-4'>
        <SiteSwitcher />
        <div className='mt-6'>
          <Navbar />
        </div>
      </div>

      {current && (
        <div className='px-3 pb-3'>
          <SidebarCapture site={current} />
        </div>
      )}

      <div className='border-t border-white/[0.06] p-3'>
        <div className='flex items-center gap-3 rounded-lg px-2 py-2'>
          <span className='grid size-9 flex-none place-items-center rounded-full bg-gradient-to-br from-teal-300 to-teal-600 text-[13px] font-semibold text-slate-950'>
            {initials(name)}
          </span>
          <div className='min-w-0 flex-1'>
            <p className='truncate text-sm font-medium text-white'>{user?.name}</p>
            <p className='truncate text-[11px] text-gray-400'>{user?.email}</p>
            {isSuperAdmin && <p className='mt-0.5 text-[10px] uppercase tracking-wide text-teal-400'>Super admin</p>}
          </div>
        </div>

        <button
          type='button'
          onClick={onLogout}
          disabled={isLoading}
          className='mt-1 flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-gray-300 transition-colors hover:bg-[#161a27] hover:text-white disabled:opacity-60'
        >
          <CiLogout className='text-lg' />
          {isLoading ? 'Logging out...' : 'Logout'}
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
