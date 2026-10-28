import type { ApiErrorBody } from '../types/api'

function body(err: unknown): ApiErrorBody | undefined {
  if (typeof err === 'object' && err !== null && 'data' in err) {
    const data = (err as { data?: unknown }).data
    if (typeof data === 'object' && data !== null && 'error' in data) return data as ApiErrorBody
  }
  return undefined
}

// Backend ka error code, jaise "email_not_verified".
export function errorCode(err: unknown): string | undefined {
  return body(err)?.error.code
}

// User ko dikhane wala message.
export function errorMessage(err: unknown): string {
  const b = body(err)
  if (b) {
    const details = b.error.details
    return details?.length ? details.map((d) => d.message).join(' ') : b.error.message
  }
  if (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    (err as { status: unknown }).status === 'FETCH_ERROR'
  ) {
    return 'Server se rabta nahi ho saka. Kya backend chal raha hai?'
  }
  return 'Something went wrong. Please try again.'
}
