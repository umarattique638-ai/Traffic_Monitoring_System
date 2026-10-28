import { Link } from 'react-router-dom'
import Form from '../../components/ui/Form'
import { linkCls, signupFields, type SignupInputs } from '../../features/auth/authForms'
import { useSignup } from '../../hooks/auth/useSignup'

function Signup() {
  const { onSubmit, isLoading } = useSignup()

  return (
    <Form<SignupInputs>
      title='Create your account'
      subtitle='Start measuring real visitors in a few minutes.'
      fields={signupFields}
      onSubmit={onSubmit}
      submitText='Create Account'
      loading={isLoading}
      footer={
        <>
          Already have an account?{' '}
          <Link to='/login' className={`font-semibold ${linkCls}`}>
            Login
          </Link>
        </>
      }
    />
  )
}

export default Signup
