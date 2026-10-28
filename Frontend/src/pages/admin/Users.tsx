import UsersTable from '../../components/admin/UsersTable'
import UsersToolbar from '../../components/admin/UsersToolbar'
import Pagination from '../../components/ui/Pagination'
import { useUsers } from '../../hooks/admin/useUsers'
import { errorMessage } from '../../utils/apiError'

function Users() {
  const { list, isFetching, error, search, setSearch, status, setStatus, page, setPage } = useUsers()

  return (
    <div className='p-8'>
      <h1 className='text-2xl font-bold text-gray-900'>Users</h1>

      <UsersToolbar
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        loading={isFetching}
      />

      {error && <p className='mt-4 text-sm text-red-500'>{errorMessage(error)}</p>}

      <UsersTable users={list?.users ?? []} />

      {list && <Pagination page={page} totalPages={list.totalPages} onChange={setPage} />}
    </div>
  )
}

export default Users
