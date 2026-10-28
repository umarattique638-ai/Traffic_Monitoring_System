import { useSites } from './useSites'

/** The site the report pages show, or null when the user has none yet. */
export function useCurrentSite() {
  return useSites().current
}
