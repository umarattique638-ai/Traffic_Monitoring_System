import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQueryWithReauth } from './baseQueryWithReauth'

// One API object; every feature (auth, admin, sites, setup, stats, reports, account) injects its endpoints.
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Me', 'Users', 'Sites', 'Site', 'Setup', 'Health', 'Reports', 'Activity'],
  endpoints: () => ({}),
})
