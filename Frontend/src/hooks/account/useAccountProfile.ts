import { useAccountProfileQuery } from '../../features/account/accountApi'

const FALLBACK = { choices: [30, 90, 180, 395], max: 395, default: 395 }

/** The retention choices of this deployment (days), from the API. */
export function useRetentionChoices() {
  const { data } = useAccountProfileQuery()
  return data?.data.retention ?? FALLBACK
}
