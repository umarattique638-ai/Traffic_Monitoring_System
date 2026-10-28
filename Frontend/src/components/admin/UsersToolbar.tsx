import type { UserStatusFilter } from '../../hooks/admin/useUsers'

type Props = {
  search: string
  onSearchChange: (value: string) => void
  status: UserStatusFilter
  onStatusChange: (value: UserStatusFilter) => void
  loading: boolean
}

// Search box and status filter above the users table.
function UsersToolbar({ search, onSearchChange, status, onStatusChange, loading }: Props) {
  return (
    <div className='mt-6 flex flex-wrap gap-3'>
      <input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder='Search name or email'
        className='w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-600'
      />
      <select
        value={status ?? ''}
        onChange={(e) => onStatusChange((e.target.value || undefined) as UserStatusFilter)}
        className='rounded-lg border border-gray-300 px-3 py-2 text-sm'
      >
        <option value=''>All</option>
        <option value='active'>Active</option>
        <option value='blocked'>Blocked</option>
        <option value='unverified'>Unverified</option>
      </select>
      {loading && <span className='self-center text-sm text-gray-400'>Loading...</span>}
    </div>
  )
}

export default UsersToolbar
