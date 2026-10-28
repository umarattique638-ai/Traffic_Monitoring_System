import { Link } from 'react-router-dom'
import type { Field } from '../../components/ui/Form'

// Form inputs and their fields (labels, types and checks) for every auth page.
export const linkCls = 'text-teal-700 underline-offset-2 hover:underline dark:text-teal-400'

export type LoginInputs = { email: string; password: string }
export type SignupInputs = { name: string; email: string; password: string; confirmpassword: string }
export type ForgotInputs = { email: string }
export type OtpInputs = { otp: string }
export type ResetInputs = { password: string; confirmpassword: string }

export const loginFields: Field<LoginInputs>[] = [
  {
    name: 'email',
    label: 'Work email',
    type: 'email',
    autoComplete: 'email',
    placeholder: 'you@company.com',
    rules: { required: 'Email Field is required' },
  },
  {
    name: 'password',
    label: 'Password',
    type: 'password',
    autoComplete: 'current-password',
    placeholder: 'Enter your password',
    rules: { required: 'Password Field is required' },
    labelRight: (
      <Link to='/forgot-password' className={`text-sm font-medium ${linkCls}`}>
        Forgot password?
      </Link>
    ),
  },
]

export const signupFields: Field<SignupInputs>[] = [
  {
    name: 'name',
    label: 'Name',
    type: 'text',
    rules: {
      required: 'Name Field is required',
      minLength: { value: 2, message: 'Name must be at least 2 characters' },
    },
  },
  {
    name: 'email',
    label: 'Email',
    type: 'email',
    rules: { required: 'Email Field is required' },
  },
  {
    name: 'password',
    label: 'Password',
    autoComplete: 'new-password',
    type: 'password',
    rules: {
      required: 'Password Field is required',
      minLength: { value: 8, message: 'Password must be at least 8 characters' },
    },
  },
  {
    name: 'confirmpassword',
    label: 'Confirm Password',
    autoComplete: 'new-password',
    type: 'password',
    rules: {
      required: 'Confirm Password Field is required',
      validate: (value, formValues) => value === formValues.password || 'Passwords do not match',
    },
  },
]

export const forgotFields: Field<ForgotInputs>[] = [
  {
    name: 'email',
    label: 'Email',
    type: 'email',
    rules: { required: 'Email Field is required' },
  },
]

export const otpFields: Field<OtpInputs>[] = [
  {
    name: 'otp',
    label: 'Verification code',
    type: 'otp',
    otpLength: 6,
    rules: { required: 'OTP Field is required' },
  },
]

export const resetFields: Field<ResetInputs>[] = [
  {
    name: 'password',
    label: 'New Password',
    type: 'password',
    autoComplete: 'new-password',
    rules: {
      required: 'New Password Field is required',
      minLength: { value: 8, message: 'New Password must be at least 8 characters' },
    },
  },
  {
    name: 'confirmpassword',
    label: 'Confirm Password',
    type: 'password',
    autoComplete: 'new-password',
    rules: {
      required: 'Confirm Password Field is required',
      validate: (value, formValues) => value === formValues.password || 'Passwords do not match',
    },
  },
]
