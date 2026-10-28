import Form from '../../components/ui/Form'
import { forgotFields, type ForgotInputs } from '../../features/auth/authForms'
import { useForgotPassword } from '../../hooks/auth/useForgotPassword'

function Forgotpassword() {
  const { onSubmit, isLoading } = useForgotPassword()

  return (
    <Form<ForgotInputs>
      title='Forgot password?'
      subtitle='We will e-mail you a 6-digit code.'
      fields={forgotFields}
      onSubmit={onSubmit}
      submitText='Send OTP'
      loading={isLoading}
    />
  )
}

export default Forgotpassword
