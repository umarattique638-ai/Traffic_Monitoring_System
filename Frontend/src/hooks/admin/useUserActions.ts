import { withToast } from '../../utils/withToast'
import type { AdminUser, Role } from '../../types/api'
import {
  useBlockUserMutation,
  useChangeRoleMutation,
  useDeleteUserMutation,
  useUnblockUserMutation,
} from '../../features/admin/adminApi'

// What a super admin can do to a user. Each action shows a toast; RTK Query reloads the list itself
// (the mutations invalidate the 'Users' tag).
export function useUserActions() {
  const [changeRoleMutation] = useChangeRoleMutation()
  const [blockMutation] = useBlockUserMutation()
  const [unblockMutation] = useUnblockUserMutation()
  const [deleteMutation] = useDeleteUserMutation()

  const changeRole = (user: AdminUser, role: Role) =>
    withToast(changeRoleMutation({ id: user.id, role }).unwrap())

  const block = (user: AdminUser) => withToast(blockMutation({ id: user.id }).unwrap())

  const unblock = (user: AdminUser) => withToast(unblockMutation(user.id).unwrap())

  // Delete cannot be undone, so ask first.
  const remove = (user: AdminUser) => {
    if (window.confirm(`Delete ${user.email}? This cannot be undone.`)) {
      void withToast(deleteMutation(user.id).unwrap())
    }
  }

  return { changeRole, block, unblock, remove }
}
