import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import type { SerializedError } from '@reduxjs/toolkit'
import { errorMessage } from '../../utils/apiError'

/** What a report page needs from a polled query: the data of the current arguments, and the latest error. */
export interface Polled<T> {
  data: T | null
  error: string | null
  loading: boolean
}

interface QueryLike<T> {
  currentData?: { data: T }
  error?: FetchBaseQueryError | SerializedError
  isLoading: boolean
  isFetching: boolean
}

/**
 * `currentData` is the answer for the current site/period only (never the previous site's numbers while the
 * new ones load). A failed refresh keeps the last good answer and says why.
 */
export function polled<T>(q: QueryLike<T>): Polled<T> {
  return {
    data: q.currentData?.data ?? null,
    error: q.error ? errorMessage(q.error) : null,
    loading: q.isLoading || (q.isFetching && !q.currentData),
  }
}
