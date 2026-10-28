import { baseApi } from '../../services/baseApi'
import type { ApiSuccess } from '../../types/api'
import type { AuditEntry, Erasure, Retention } from '../../types/tailwatch'
import { clearUser } from '../auth/authSlice'

export interface ActivityPage {
  keepDays: number
  entries: AuditEntry[]
  next: string | null
}

export interface ActivityParams {
  site: number | null
  before: string | null
}

export const accountApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** Account-wide settings of this deployment (retention choices). */
    accountProfile: build.query<ApiSuccess<{ retention: Retention }>, void>({
      query: () => '/account',
    }),
    /** The activity log, newest first, 50 at a time; `before` is the cursor of the next page. */
    activity: build.query<ApiSuccess<ActivityPage>, ActivityParams>({
      query: ({ site, before }) => ({
        url: '/account/activity',
        params: { limit: 50, site: site ?? undefined, before: before ?? undefined },
      }),
      // One cache entry per site filter: "Show older" appends the next page to it (deduplicated by id),
      // a first page (no cursor) replaces it.
      serializeQueryArgs: ({ endpointName, queryArgs }) => `${endpointName}:${queryArgs.site ?? 'all'}`,
      merge: (cache, incoming, { arg }) => {
        if (!arg.before) return incoming
        const seen = new Set(cache.data.entries.map((e) => e.id))
        cache.data.entries.push(...incoming.data.entries.filter((e) => !seen.has(e.id)))
        cache.data.next = incoming.data.next
        cache.data.keepDays = incoming.data.keepDays
      },
      forceRefetch: ({ currentArg, previousArg }) =>
        currentArg?.before !== previousArg?.before || currentArg?.site !== previousArg?.site,
      providesTags: ['Activity'],
    }),
    deleteAccount: build.mutation<ApiSuccess<{ erasure: Erasure }>, { password: string; confirm: string }>({
      query: (body) => ({ url: '/account/delete', method: 'POST', body }),
      // The session is gone: the user becomes a guest and every cached answer is dropped.
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled
          dispatch(clearUser())
          dispatch(baseApi.util.resetApiState())
        } catch {
          // wrong password etc.: the form shows the error
        }
      },
    }),
  }),
})

export const { useAccountProfileQuery, useActivityQuery, useDeleteAccountMutation } = accountApi
