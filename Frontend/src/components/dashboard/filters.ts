import { FileText, Globe, Link2, MapPin, Monitor } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { FilterKey } from '../../types/tailwatch'
import { capital, countryName } from '../../utils/format'

/** What can be filtered, in the menu's order. */
export const FILTERS: { key: FilterKey; label: string; icon: LucideIcon; search: string }[] = [
  { key: 'page', label: 'Page', icon: FileText, search: 'Search pages, e.g. /pricing' },
  { key: 'source', label: 'Referrer', icon: Link2, search: 'Search referrers' },
  { key: 'country', label: 'Country', icon: MapPin, search: 'Search countries' },
  { key: 'device', label: 'Device', icon: Monitor, search: 'Search devices' },
  { key: 'browser', label: 'Browser', icon: Globe, search: 'Search browsers' },
]

/** A value as people read it (country code -> name, "desktop" -> "Desktop"). */
export const filterLabel = (key: FilterKey, value: string) => {
  if (key === 'device') return capital(value)
  if (key !== 'country') return value
  try {
    return countryName(value)
  } catch {
    return value // not a country code: show it as it is
  }
}
