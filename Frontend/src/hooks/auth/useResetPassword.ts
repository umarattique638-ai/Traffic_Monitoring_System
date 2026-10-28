import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../redux'
import { withToast } from '../../utils/withToast'
import { useResetPasswordMutation } from '../../features/auth/authApi'
import type { ResetInputs } from '../../features/auth/authForms'
import { clearReset } from '../../features/auth/authSlice'

// Step 3: new password with the reset token; then the reset data is cleared and the user logs in again.
export function useResetPassword() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const resetToken = useAppSelector((s) => s.auth.resetToken)
  const [resetPassword, { isLoading }] = useResetPasswordMutation()
  // After success the token is cleared; this stops the page from sending us back to step 1.
  const [finished, setFinished] = useState(false)

  const onSubmit = async (data: ResetInputs) => {
    if (!resetToken) return
    const res = await withToast(
      resetPassword({ resetToken, password: data.password, confirmPassword: data.confirmpassword }).unwrap(),
    )
    if (!res) return
    setFinished(true)
    dispatch(clearReset())
    navigate('/login', { replace: true })
  }

  return { canReset: Boolean(resetToken) || finished, onSubmit, isLoading }
}
