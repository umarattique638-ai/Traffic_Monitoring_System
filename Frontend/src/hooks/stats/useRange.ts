import { useCallback } from 'react'
import { setRange } from '../../features/sites/siteSlice'
import type { RangeKey } from '../../types/tailwatch'
import { useAppDispatch, useAppSelector } from '../redux'

/** The period shared by the report pages (Overview, Events, Suspicious activity), kept in the store. */
export function useRange(): [RangeKey, (r: RangeKey) => void] {
  const dispatch = useAppDispatch()
  const range = useAppSelector((s) => s.site.range)
  const change = useCallback((r: RangeKey) => dispatch(setRange(r)), [dispatch])
  return [range, change]
}
