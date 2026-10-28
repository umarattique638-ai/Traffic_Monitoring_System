import { Link } from 'react-router-dom'
import Form from '../../components/ui/Form'
import { linkCls, loginFields, type LoginInputs } from '../../features/auth/authForms'
import { useLogin } from '../../hooks/auth/useLogin'

function Login() {
  const { onSubmit, isLoading, unverifiedEmail, resend, resending } = useLogin()

  return (
    <Form<LoginInputs>
      title='Welcome back'
      subtitle='Log in to see your analytics.'
      fields={loginFields}
      onSubmit={onSubmit}
      submitText='Login'
      loading={isLoading}
      footer={
        <>
          {unverifiedEmail && (
            <p className='mb-3'>
              Didn't get the email?{' '}
              <button
                type='button'
                onClick={resend}
                disabled={resending}
                className={`font-semibold cursor-pointer ${linkCls}`}
              >
                {resending ? 'Sending...' : 'Send it again'}
              </button>
            </p>
          )}
          Don't have an account?{' '}
          <Link to='/signup' className={`font-semibold ${linkCls}`}>
            Sign up
          </Link>
        </>
      }
    />
  )
}

export default Login
