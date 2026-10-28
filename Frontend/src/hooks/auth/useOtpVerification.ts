import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../redux'
import { withToast } from '../../utils/withToast'
import { useForgotPasswordMutation, useVerifyOtpMutation } from '../../features/auth/authApi'
import type { OtpInputs } from '../../features/auth/authForms'
import { setResetToken } from '../../features/auth/authSlice'

// Step 2: the code is exchanged for a reset token (kept only in memory).
export function useOtpVerification() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const email = useAppSelector((s) => s.auth.resetEmail)
  const [verifyOtp, { isLoading }] = useVerifyOtpMutation()
  const [forgotPassword, { isLoading: resending }] = useForgotPasswordMutation()

  const onSubmit = async (data: OtpInputs) => {
    if (!email) return
    const res = await withToast(verifyOtp({ email, otp: data.otp }).unwrap())
    if (!res) return
    dispatch(setResetToken(res.data.resetToken))
    navigate('/reset-password')
  }

  const resend = async () => {
    if (email) await withToast(forgotPassword({ email }).unwrap())
  }

  return { email, onSubmit, isLoading, resend, resending }
}
