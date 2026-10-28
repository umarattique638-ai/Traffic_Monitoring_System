import { useNavigate } from 'react-router-dom'
import { useAppDispatch } from '../redux'
import { withToast } from '../../utils/withToast'
import { useForgotPasswordMutation } from '../../features/auth/authApi'
import type { ForgotInputs } from '../../features/auth/authForms'
import { setResetEmail } from '../../features/auth/authSlice'

// Step 1: e-mail a code, remember the email for the next page.
export function useForgotPassword() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation()

  const onSubmit = async (data: ForgotInputs) => {
    const res = await withToast(forgotPassword({ email: data.email }).unwrap())
    if (!res) return
    dispatch(setResetEmail(data.email))
    navigate('/otp-verification')
  }

  return { onSubmit, isLoading }
}
