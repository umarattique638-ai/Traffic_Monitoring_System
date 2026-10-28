import { baseApi } from '../../services/baseApi'
import type { AdminUser, ApiSuccess, Role } from '../../types/api'

export interface UserListParams {
  q?: string
  status?: 'active' | 'blocked' | 'unverified'
  page: number
}

interface UserList {
  users: AdminUser[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export const adminApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listUsers: build.query<ApiSuccess<UserList>, UserListParams>({
      query: ({ q, status, page }) => ({
        url: '/admin/users',
        params: { q: q || undefined, status, page, limit: 10 },
      }),
      providesTags: ['Users'],
    }),
    changeRole: build.mutation<ApiSuccess<{ user: AdminUser }>, { id: string; role: Role }>({
      query: ({ id, role }) => ({ url: `/admin/users/${id}/role`, method: 'PATCH', body: { role } }),
      invalidatesTags: ['Users'],
    }),
    blockUser: build.mutation<ApiSuccess<{ user: AdminUser }>, { id: string; reason?: string }>({
      query: ({ id, reason }) => ({ url: `/admin/users/${id}/block`, method: 'POST', body: { reason } }),
      invalidatesTags: ['Users'],
    }),
    unblockUser: build.mutation<ApiSuccess<{ user: AdminUser }>, string>({
      query: (id) => ({ url: `/admin/users/${id}/unblock`, method: 'POST' }),
      invalidatesTags: ['Users'],
    }),
    deleteUser: build.mutation<ApiSuccess<null>, string>({
      query: (id) => ({ url: `/admin/users/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Users'],
    }),
  }),
})

export const {
  useListUsersQuery,
  useChangeRoleMutation,
  useBlockUserMutation,
  useUnblockUserMutation,
  useDeleteUserMutation,
} = adminApi
