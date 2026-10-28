import type { AdminUser } from '../../types/api'

const STYLES = {
  blocked: 'bg-red-100 text-red-700',
  active: 'bg-green-100 text-green-700',
  unverified: 'bg-amber-100 text-amber-700',
} as const

const LABELS = { blocked: 'Blocked', active: 'Active', unverified: 'Unverified' } as const

function statusOf(user: AdminUser): keyof typeof STYLES {
  if (user.isBlocked) return 'blocked'
  return user.isEmailVerified ? 'active' : 'unverified'
}

// A small coloured label: Blocked (red), Active (green), Unverified (amber).
function StatusBadge({ user }: { user: AdminUser }) {
  const status = statusOf(user)
  return <span className={`rounded-full px-2 py-0.5 text-xs ${STYLES[status]}`}>{LABELS[status]}</span>
}

export default StatusBadge
