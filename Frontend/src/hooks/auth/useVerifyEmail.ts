import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { errorMessage } from '../../utils/apiError'
import { useVerifyEmailMutation } from '../../features/auth/authApi'

export type VerifyState = 'verifying' | 'success' | 'error'

// Reads ?token= from the link and sends it to the backend once.
export function useVerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [verifyEmail] = useVerifyEmailMutation()
  const [state, setState] = useState<VerifyState>(token ? 'verifying' : 'error')
  const [message, setMessage] = useState(token ? 'Verifying your email...' : 'This link has no token.')
  // StrictMode runs effects twice in development; the token works only once.
  const sent = useRef(false)

  useEffect(() => {
    if (!token || sent.current) return
    sent.current = true
    verifyEmail({ token })
      .unwrap()
      .then((res) => {
        setState('success')
        setMessage(res.message)
      })
      .catch((err) => {
        setState('error')
        setMessage(errorMessage(err))
      })
  }, [token, verifyEmail])

  return { state, message }
}
