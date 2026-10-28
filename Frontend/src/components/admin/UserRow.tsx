import type { AdminUser, Role } from '../../types/api'
import StatusBadge from './StatusBadge'

type Props = {
  user: AdminUser
  // Protected (SUPER_ADMIN_EMAILS) or the super admin's own account: no actions.
  locked: boolean
  onChangeRole: (user: AdminUser, role: Role) => void
  onBlock: (user: AdminUser) => void
  onUnblock: (user: AdminUser) => void
  onDelete: (user: AdminUser) => void
}

// One user in the table: name, email, role, status and actions.
function UserRow({ user, locked, onChangeRole, onBlock, onUnblock, onDelete }: Props) {
  return (
    <tr className='border-t border-gray-100'>
      <td className='px-4 py-3 font-medium text-gray-900'>{user.name}</td>
      <td className='px-4 py-3 text-gray-600'>{user.email}</td>
      <td className='px-4 py-3'>
        <select
          value={user.role}
          disabled={locked}
          onChange={(e) => onChangeRole(user, e.target.value as Role)}
          className='rounded border border-gray-300 px-2 py-1 disabled:opacity-50'
        >
          <option value='admin'>admin</option>
          <option value='super_admin'>super_admin</option>
        </select>
      </td>
      <td className='px-4 py-3'>
        <StatusBadge user={user} />
      </td>
      <td className='px-4 py-3'>
        {locked ? (
          <span className='text-xs text-gray-400'>{user.isProtected ? 'Protected' : 'You'}</span>
        ) : (
          <div className='flex gap-2'>
            {user.isBlocked ? (
              <button
                onClick={() => onUnblock(user)}
                className='text-teal-700 hover:underline cursor-pointer'
              >
                Unblock
              </button>
            ) : (
              <button onClick={() => onBlock(user)} className='text-amber-700 hover:underline cursor-pointer'>
                Block
              </button>
            )}
            <button onClick={() => onDelete(user)} className='text-red-600 hover:underline cursor-pointer'>
              Delete
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

export default UserRow
