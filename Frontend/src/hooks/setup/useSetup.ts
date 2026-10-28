import { useGetSetupQuery } from '../../features/setup/setupApi'

/** The site being set up, or null. Not a site yet: nothing is stored for it until the install check passes. */
export function useSetup() {
  const { data, isLoading } = useGetSetupQuery()
  return { setup: data?.data.setup ?? null, isLoading }
}
