import type { RangeKey } from '../../types/tailwatch'

/** The periods of the report pages. */
export const RANGES: { value: RangeKey; label: string; long: string; hint: string }[] = [
  { value: 'today', label: 'Today', long: 'Today', hint: 'Since midnight, per hour' },
  { value: '7d', label: '7 days', long: 'Last 7 days', hint: 'Per day' },
  { value: '30d', label: '30 days', long: 'Last 30 days', hint: 'Per day' },
]
export const rangeLong = (r: RangeKey) => RANGES.find((x) => x.value === r)?.long ?? r
