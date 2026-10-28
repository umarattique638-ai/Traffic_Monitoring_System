import { Link } from 'react-router-dom'
import { useVerifyEmail, type VerifyState } from '../../hooks/auth/useVerifyEmail'

const TITLES: Record<VerifyState, string> = {
  verifying: 'Please wait',
  success: 'Email verified',
  error: 'Verification failed',
}

// The link from the e-mail opens here: /verify-email?token=...
function VerifyEmail() {
  const { state, message } = useVerifyEmail()

  return (
    <div className='w-full max-w-sm sm:max-w-md rounded-2xl bg-white p-8 text-center shadow-xl'>
      <h2 className='text-2xl font-bold text-gray-900'>{TITLES[state]}</h2>
      <p className={`mt-3 text-sm ${state === 'error' ? 'text-red-500' : 'text-gray-500'}`}>{message}</p>
      {state !== 'verifying' && (
        <Link
          to='/login'
          className='mt-6 inline-block rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800'
        >
          Go to login
        </Link>
      )}
    </div>
  )
}

export default VerifyEmail
