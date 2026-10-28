import { useState } from 'react'
import { useListUsersQuery, type UserListParams } from '../../features/admin/adminApi'

export type UserStatusFilter = UserListParams['status']

// Search, status filter and page for the users table. Changing a filter goes back to page 1.
export function useUsers() {
  const [search, setSearchValue] = useState('')
  const [status, setStatusValue] = useState<UserStatusFilter>(undefined)
  const [page, setPage] = useState(1)

  const { data, isFetching, error } = useListUsersQuery({ q: search, status, page })

  const setSearch = (value: string) => {
    setSearchValue(value)
    setPage(1)
  }

  const setStatus = (value: UserStatusFilter) => {
    setStatusValue(value)
    setPage(1)
  }

  return { list: data?.data, isFetching, error, search, setSearch, status, setStatus, page, setPage }
}
