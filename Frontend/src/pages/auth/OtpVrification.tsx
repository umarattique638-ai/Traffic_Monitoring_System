import { Navigate } from 'react-router-dom'
import Form from '../../components/ui/Form'
import { otpFields, type OtpInputs } from '../../features/auth/authForms'
import { useOtpVerification } from '../../hooks/auth/useOtpVerification'

function OtpVerification() {
  const { email, onSubmit, isLoading, resend, resending } = useOtpVerification()

  // Opened directly (no email from step 1): start again.
  if (!email) return <Navigate to='/forgot-password' replace />

  return (
    <Form<OtpInputs>
      title='Check your e-mail'
      subtitle={`Enter the 6-digit code we sent to ${email}.`}
      fields={otpFields}
      onSubmit={onSubmit}
      submitText='Verify'
      loading={isLoading}
      defaultValues={{ otp: '' }}
      footer={
        <button
          type='button'
          onClick={resend}
          disabled={resending}
          className='font-semibold text-teal-700 hover:underline cursor-pointer'
        >
          {resending ? 'Sending...' : 'Send a new code'}
        </button>
      }
    />
  )
}

export default OtpVerification
