import { toast } from 'react-toastify'
import { errorMessage } from './apiError'

// Runs a request: success → green toast with the backend message, error → red toast.
// Returns the response, or null when it failed (so the caller can stop).
export async function withToast<T extends { message: string }>(request: Promise<T>): Promise<T | null> {
  try {
    const res = await request
    toast.success(res.message)
    return res
  } catch (err) {
    toast.error(errorMessage(err))
    return null
  }
}
