import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { LuMenu } from 'react-icons/lu'
import logo from '../../assets/lg.png'
import { useSites } from '../../hooks/sites/useSites'
import { useSiteFromLink } from '../../hooks/sites/useSiteFromLink'
import Sidebar from '../common/Sidebar'
import SyncBanner from '../sites/SyncBanner'
import PageLoading from '../ui/PageLoading'

const SETUP_PATHS = ['/sites/new', '/install', '/verify']

// The signed-in frame: sidebar (a drawer on phones), the sync banner, and the page.
function Mainlayout() {
  const { pathname } = useLocation()
  const { current, isLoading } = useSites()
  // The drawer is open for the page it was opened on: going to another page closes it by itself.
  const [drawerOn, setDrawerOn] = useState<string | null>(null)
  const drawer = drawerOn === pathname
  const setDrawer = (open: boolean) => setDrawerOn(open ? pathname : null)
  useSiteFromLink()

  // Escape closes it too.
  useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOn(null)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawer])

  const isSetup = SETUP_PATHS.includes(pathname)

  return (
    <div className='flex h-dvh overflow-hidden bg-[#f8fafc]'>
      {drawer && (
        <div
          onClick={() => setDrawer(false)}
          aria-hidden='true'
          className='fixed inset-0 z-[90] bg-slate-950/60 lg:hidden'
        />
      )}

      <Sidebar open={drawer} onClose={() => setDrawer(false)} />

      <div className='flex min-w-0 flex-1 flex-col overflow-hidden'>
        <header className='flex flex-none items-center gap-3 bg-[#020618] px-4 py-2.5 text-white lg:hidden'>
          <button
            type='button'
            onClick={() => setDrawer(true)}
            aria-label='Open menu'
            aria-expanded={drawer}
            className='grid size-9 place-items-center rounded-lg text-gray-300 hover:bg-white/10 hover:text-white'
          >
            <LuMenu className='text-xl' />
          </button>
          <img src={logo} alt='Tailwatch' className='h-8 w-auto object-contain' />
          <span className='ml-auto max-w-[45%] truncate text-xs text-gray-400'>{current?.domain}</span>
        </header>

        <main className='relative flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-8 sm:px-6 lg:px-10 lg:py-10'>
          <div
            aria-hidden='true'
            className='pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-[radial-gradient(ellipse_at_50%_-30%,rgba(45,212,191,0.13),transparent_65%)]'
          />
          <div className={`relative mx-auto flex w-full flex-col ${isSetup ? 'my-auto shrink-0' : 'flex-1'}`}>
            <SyncBanner />
            {isLoading ? (
              <PageLoading />
            ) : (
              <Suspense fallback={<PageLoading />}>
                <Outlet />
              </Suspense>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default Mainlayout
