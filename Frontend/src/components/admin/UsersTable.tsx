import { useAuth } from '../../hooks/auth/useAuth'
import { useUserActions } from '../../hooks/admin/useUserActions'
import type { AdminUser } from '../../types/api'
import UserRow from './UserRow'

const COLUMNS = ['Name', 'Email', 'Role', 'Status', 'Actions']

// The users table. Each row gets the actions from useUserActions.
function UsersTable({ users }: { users: AdminUser[] }) {
  const { user: me } = useAuth()
  const { changeRole, block, unblock, remove } = useUserActions()

  return (
    <div className='mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white'>
      <table className='w-full text-left text-sm'>
        <thead className='bg-gray-50 text-gray-500'>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c} className='px-4 py-3'>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              locked={u.isProtected || u.id === me?.id}
              onChangeRole={changeRole}
              onBlock={block}
              onUnblock={unblock}
              onDelete={remove}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default UsersTable
