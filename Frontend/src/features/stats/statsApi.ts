import { baseApi } from '../../services/baseApi'
import type { ApiSuccess } from '../../types/api'
import type {
  DropsReport,
  EventsReport,
  FilterKey,
  Live,
  Overview,
  OverviewFilters,
  RangeKey,
} from '../../types/tailwatch'

interface SiteRange {
  siteId: number
  range: RangeKey
}

// Read-only reports from ClickHouse. The pages poll these (pollingInterval), so no tags are needed.
export const statsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    overview: build.query<ApiSuccess<Overview>, SiteRange & { filters?: OverviewFilters }>({
      query: ({ siteId, range, filters = {} }) => ({
        url: `/sites/${siteId}/stats/overview`,
        params: { range, ...filters },
      }),
    }),
    live: build.query<ApiSuccess<Live>, number>({
      query: (siteId) => `/sites/${siteId}/stats/live`,
    }),
    events: build.query<ApiSuccess<EventsReport>, SiteRange>({
      query: ({ siteId, range }) => ({ url: `/sites/${siteId}/stats/events`, params: { range } }),
    }),
    drops: build.query<ApiSuccess<DropsReport>, SiteRange>({
      query: ({ siteId, range }) => ({ url: `/sites/${siteId}/stats/drops`, params: { range } }),
    }),
    /** The Filter menu: values of one filter in the period, most used first (`q`: search). */
    filterValues: build.query<
      ApiSuccess<{ values: { value: string; count: number }[] }>,
      SiteRange & { key: FilterKey; q: string }
    >({
      query: ({ siteId, range, key, q }) => ({
        url: `/sites/${siteId}/stats/filter-values`,
        params: { range, key, q },
      }),
    }),
  }),
})

export const { useOverviewQuery, useLiveQuery, useEventsQuery, useDropsQuery, useFilterValuesQuery } = statsApi
