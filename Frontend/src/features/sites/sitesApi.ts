import { baseApi } from '../../services/baseApi'
import type { ApiSuccess } from '../../types/api'
import type { ChangeDomainResult, KvIssue, Site, SiteHealth, Snippet, Sync } from '../../types/tailwatch'

export interface SiteList {
  sites: Site[]
  kvIssues: KvIssue[]
}

export interface SitePatch {
  timezone?: string
  status?: 'active' | 'paused'
  retentionDays?: number
}

type SiteSaved = ApiSuccess<{ site: Site; sync: Sync }>

// Every site change reloads the list ('Sites'); a site's own data is tagged by its id.
export const sitesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listSites: build.query<ApiSuccess<SiteList>, void>({
      query: () => '/sites',
      providesTags: ['Sites'],
    }),
    getSite: build.query<ApiSuccess<{ site: Site; snippets: Snippet[] }>, number>({
      query: (id) => `/sites/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Site', id }],
    }),
    previewDomain: build.query<ApiSuccess<{ domain: string; allowedHosts: string[] }>, string>({
      query: (domain) => ({ url: '/sites/preview', params: { domain } }),
    }),
    syncAll: build.mutation<ApiSuccess<{ kvIssues: KvIssue[] }>, void>({
      query: () => ({ url: '/sites/sync-all', method: 'POST' }),
      invalidatesTags: ['Sites'],
    }),
    updateSite: build.mutation<SiteSaved, { id: number; patch: SitePatch }>({
      query: ({ id, patch }) => ({ url: `/sites/${id}`, method: 'PATCH', body: patch }),
      invalidatesTags: (_r, _e, { id }) => ['Sites', { type: 'Site', id }],
    }),
    /** `eraseData`: delete everything collected for the site too, for good. */
    deleteSite: build.mutation<ApiSuccess<{ sync: Sync; erased: boolean }>, { id: number; eraseData: boolean }>({
      query: ({ id, eraseData }) => ({ url: `/sites/${id}`, method: 'DELETE', body: { eraseData } }),
      invalidatesTags: ['Sites', 'Activity'],
    }),
    siteHealth: build.query<ApiSuccess<{ health: SiteHealth }>, number>({
      query: (id) => `/sites/${id}/health`,
      providesTags: (_r, _e, id) => [{ type: 'Health', id }],
    }),
    /** "Check again": the server opens the site now. */
    checkHealth: build.mutation<ApiSuccess<{ health: SiteHealth }>, number>({
      query: (id) => ({ url: `/sites/${id}/health/check`, method: 'POST' }),
    }),
    /** The site moved: switch only if the same snippet passes the install check on the new domain. */
    changeDomain: build.mutation<ApiSuccess<ChangeDomainResult>, { id: number; domain: string }>({
      query: ({ id, domain }) => ({ url: `/sites/${id}/domain`, method: 'POST', body: { domain } }),
      invalidatesTags: (r, _e, { id }) => (r?.data.ok ? ['Sites', { type: 'Site', id }, { type: 'Health', id }] : []),
    }),
    createKey: build.mutation<SiteSaved, number>({
      query: (id) => ({ url: `/sites/${id}/keys`, method: 'POST' }),
      invalidatesTags: (_r, _e, id) => ['Sites', { type: 'Site', id }],
    }),
    revokeKey: build.mutation<SiteSaved, { id: number; keyId: string }>({
      query: ({ id, keyId }) => ({ url: `/sites/${id}/keys/${keyId}/revoke`, method: 'POST' }),
      invalidatesTags: (_r, _e, { id }) => ['Sites', { type: 'Site', id }],
    }),
  }),
})

export const {
  useListSitesQuery,
  useGetSiteQuery,
  usePreviewDomainQuery,
  useSyncAllMutation,
  useUpdateSiteMutation,
  useDeleteSiteMutation,
  useSiteHealthQuery,
  useCheckHealthMutation,
  useChangeDomainMutation,
  useCreateKeyMutation,
  useRevokeKeyMutation,
} = sitesApi
