import { useGetSiteQuery } from '../../features/sites/sitesApi'
import type { Site } from '../../types/tailwatch'
import { errorMessage } from '../../utils/apiError'

/** The snippets of a saved site (the script tag, and the custom-event code), made by the API for its key. */
export function useSnippets(site: Site | null) {
  const { data, isLoading, error } = useGetSiteQuery(site?.id ?? 0, { skip: !site })
  const snippets = data?.data.snippets ?? null
  return {
    tag: snippets?.find((s) => s.group === 'script-tag') ?? null,
    events: snippets?.find((s) => s.group === 'custom-event') ?? null,
    loading: isLoading,
    error: error ? errorMessage(error) : null,
  }
}
