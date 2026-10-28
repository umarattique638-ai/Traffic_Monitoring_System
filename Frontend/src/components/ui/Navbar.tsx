import { NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/auth/useAuth'
import {
  LuLayoutGrid,
  LuSparkles,
  LuShieldAlert,
  LuFileText,
  LuHistory,
  LuSettings,
  LuUsers,
} from 'react-icons/lu'

const sections = [
  {
    title: 'Analytics',
    links: [
      { label: 'Overview', icon: <LuLayoutGrid />, to: '/dashboard' },
      { label: 'Events', icon: <LuSparkles />, to: '/events' },
      { label: 'Suspicious activity', icon: <LuShieldAlert />, to: '/suspicious-activity' },
      { label: 'Reports', icon: <LuFileText />, to: '/reports' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Activity', icon: <LuHistory />, to: '/activity' },
      { label: 'Settings', icon: <LuSettings />, to: '/settings' },
    ],
  },
]

// Sirf super admin ko nazar aane wala hissa.
const adminSection = {
  title: 'Admin',
  links: [{ label: 'Users', icon: <LuUsers />, to: '/admin/users' }],
}

function Navbar() {
  const { isSuperAdmin } = useAuth()
  const visible = isSuperAdmin ? [...sections, adminSection] : sections

  return (
    <nav className='flex flex-col gap-6'>
      {visible.map((section) => (
        <div key={section.title}>
          <p className='px-3 mb-2 text-xs text-gray-500'>{section.title}</p>

          <ul className='flex flex-col gap-1'>
            {section.links.map((i) => (
              <li key={i.label}>
                <NavLink
                  to={i.to}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors
                      ${
                        isActive
                          ? 'bg-[#161a27] text-white font-semibold'
                          : 'text-gray-400 hover:bg-[#161a27] hover:text-white hover:font-semibold'
                      }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Left teal bar */}
                      <span
                        className={`absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-teal-400 transition-opacity
                          ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      />
                      <span className='text-lg'>{i.icon}</span>
                      {i.label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export default Navbar
