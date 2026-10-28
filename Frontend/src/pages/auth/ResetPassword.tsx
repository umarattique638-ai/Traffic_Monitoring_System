import { Navigate } from 'react-router-dom'
import Form from '../../components/ui/Form'
import { resetFields, type ResetInputs } from '../../features/auth/authForms'
import { useResetPassword } from '../../hooks/auth/useResetPassword'

function ResetPassword() {
  const { canReset, onSubmit, isLoading } = useResetPassword()

  // No reset token (page opened directly or expired): start again.
  if (!canReset) return <Navigate to='/forgot-password' replace />

  return (
    <Form<ResetInputs>
      title='Choose a new password'
      subtitle='You will be logged out on every device.'
      fields={resetFields}
      onSubmit={onSubmit}
      submitText='Reset Password'
      loading={isLoading}
    />
  )
}

export default ResetPassword
