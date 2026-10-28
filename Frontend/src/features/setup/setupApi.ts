import { baseApi } from '../../services/baseApi'
import type { ApiSuccess } from '../../types/api'
import type { Setup, VerifyResult } from '../../types/tailwatch'

// Adding a site: a setup (nothing stored) until the install check passes; then the site is saved.
export const setupApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSetup: build.query<ApiSuccess<{ setup: Setup | null }>, void>({
      query: () => '/setup',
      providesTags: ['Setup'],
    }),
    startSetup: build.mutation<ApiSuccess<{ setup: Setup; resumed: boolean }>, { domain: string; timezone: string }>({
      query: (body) => ({ url: '/setup', method: 'POST', body }),
      invalidatesTags: ['Setup'],
    }),
    verifySetup: build.mutation<ApiSuccess<VerifyResult>, { url?: string }>({
      query: (body) => ({ url: '/setup/verify', method: 'POST', body }),
      // A passed check saves the site: the site list, the setup and the activity log change.
      invalidatesTags: (r) => (r?.data.site ? ['Sites', 'Setup', 'Activity'] : []),
    }),
    cancelSetup: build.mutation<ApiSuccess<null>, void>({
      query: () => ({ url: '/setup', method: 'DELETE' }),
      invalidatesTags: ['Setup'],
    }),
  }),
})

export const { useGetSetupQuery, useStartSetupMutation, useVerifySetupMutation, useCancelSetupMutation } = setupApi
