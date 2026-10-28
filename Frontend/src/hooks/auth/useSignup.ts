import { useNavigate } from 'react-router-dom'
import { withToast } from '../../utils/withToast'
import { useSignupMutation } from '../../features/auth/authApi'
import type { SignupInputs } from '../../features/auth/authForms'

// Creates the account; on success goes to the login page (the user must verify the email first).
export function useSignup() {
  const navigate = useNavigate()
  const [signup, { isLoading }] = useSignupMutation()

  const onSubmit = async (data: SignupInputs) => {
    const res = await withToast(
      signup({ name: data.name, email: data.email, password: data.password }).unwrap(),
    )
    if (res) navigate('/login')
  }

  return { onSubmit, isLoading }
}
