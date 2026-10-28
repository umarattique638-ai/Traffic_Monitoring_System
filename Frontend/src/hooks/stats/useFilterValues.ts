import { useFilterValuesQuery } from '../../features/stats/statsApi'
import type { FilterKey, RangeKey } from '../../types/tailwatch'
import { errorMessage } from '../../utils/apiError'
import { useDebouncedValue } from '../common/useDebouncedValue'

/**
 * The values of one filter in the period, most used first. Countries are searched by name in the browser
 * (the server knows only codes); the rest is searched on the server.
 */
export function useFilterValues(siteId: number, range: RangeKey, key: FilterKey | null, query: string, open: boolean) {
  const q = useDebouncedValue(key === 'country' ? '' : query.trim(), 200)
  const res = useFilterValuesQuery({ siteId, range, key: key ?? 'page', q }, { skip: !open || !key })
  return {
    values: res.currentData?.data.values ?? null,
    error: res.error ? errorMessage(res.error) : null,
  }
}
