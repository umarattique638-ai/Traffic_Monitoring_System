import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { errorCode, errorMessage } from '../../utils/apiError'
import { withToast } from '../../utils/withToast'
import { useLoginMutation, useResendVerificationMutation } from '../../features/auth/authApi'
import type { LoginInputs } from '../../features/auth/authForms'

// Login, and "send the verification email again" when the email is not verified yet.
export function useLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const [login, { isLoading }] = useLoginMutation()
  const [resendVerification, { isLoading: resending }] = useResendVerificationMutation()
  // The email that still needs verifying (login answered email_not_verified).
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)

  const onSubmit = async (data: LoginInputs) => {
    try {
      const res = await login(data).unwrap()
      toast.success(res.message)
      // Back to the page ProtectedRoute remembered, or the dashboard.
      const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'
      navigate(from, { replace: true })
    } catch (err) {
      if (errorCode(err) === 'email_not_verified') setUnverifiedEmail(data.email)
      toast.error(errorMessage(err))
    }
  }

  const resend = async () => {
    if (!unverifiedEmail) return
    await withToast(resendVerification({ email: unverifiedEmail }).unwrap())
  }

  return { onSubmit, isLoading, unverifiedEmail, resend, resending }
}
