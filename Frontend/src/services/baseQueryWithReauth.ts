import { fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { clearUser } from '../features/auth/authSlice'
import type { ApiErrorBody } from '../types/api'

// credentials: 'include' = cookies (access_token, refresh_token) har request ke saath jayein.
const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL,
  credentials: 'include',
})

// Agar kai requests ek saath 401 payein to refresh sirf ek dafa ho; baaki isi ka intezar karein.
let refreshing: Promise<boolean> | null = null

function urlOf(args: string | FetchArgs): string {
  return typeof args === 'string' ? args : args.url
}

/**
 * Har request is se guzarti hai:
 *  1. Request bhejo.
 *  2. 401 aaya (access token expire ya cookie khatam) → POST /auth/refresh
 *  3. Refresh kamyab → wohi request dobara. Nakam → user logout (guest).
 */
export const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let result = await rawBaseQuery(args, api, extraOptions)

  const code = (result.error?.data as ApiErrorBody | undefined)?.error?.code
  const url = urlOf(args)
  const canRetry =
    !url.startsWith('/auth/login') && !url.startsWith('/auth/refresh') && !url.startsWith('/auth/logout')

  if (result.error?.status === 401 && canRetry && (code === 'token_expired' || code === 'unauthorized')) {
    if (!refreshing) {
      refreshing = (async () => {
        const r = await rawBaseQuery({ url: '/auth/refresh', method: 'POST' }, api, extraOptions)
        return !r.error
      })().finally(() => {
        refreshing = null
      })
    }
    const ok = await refreshing
    if (ok) {
      result = await rawBaseQuery(args, api, extraOptions)
    } else {
      api.dispatch(clearUser())
    }
  }
  return result
}
