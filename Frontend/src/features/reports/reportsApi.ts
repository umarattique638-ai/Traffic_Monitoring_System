import { baseApi } from '../../services/baseApi'
import type { ApiSuccess } from '../../types/api'
import type { RangeKey, Report } from '../../types/tailwatch'

export interface ReportList {
  keepDays: number
  max: number
  exports: Report[]
}

// Saved CSV reports of a site. The file itself is downloaded with utils/download.ts (a blob, not JSON).
export const reportsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listReports: build.query<ApiSuccess<ReportList>, number>({
      query: (siteId) => `/sites/${siteId}/exports`,
      providesTags: (_r, _e, siteId) => [{ type: 'Reports', id: siteId }],
    }),
    createReport: build.mutation<ApiSuccess<{ export: Report }>, { siteId: number; range: RangeKey }>({
      query: ({ siteId, range }) => ({ url: `/sites/${siteId}/exports`, method: 'POST', body: { range } }),
      invalidatesTags: (_r, _e, { siteId }) => [{ type: 'Reports', id: siteId }, 'Activity'],
    }),
    deleteReport: build.mutation<ApiSuccess<null>, { siteId: number; reportId: string }>({
      query: ({ siteId, reportId }) => ({ url: `/sites/${siteId}/exports/${reportId}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { siteId }) => [{ type: 'Reports', id: siteId }, 'Activity'],
    }),
  }),
})

export const { useListReportsQuery, useCreateReportMutation, useDeleteReportMutation } = reportsApi

/** Where a saved report is downloaded from (relative to the API base). */
export const reportDownloadPath = (siteId: number, reportId: string) => `/sites/${siteId}/exports/${reportId}/download`
