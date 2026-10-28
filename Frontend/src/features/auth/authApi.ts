import { baseApi } from '../../services/baseApi'
import type { ApiSuccess, User } from '../../types/api'
import { clearUser, setUser } from './authSlice'

type UserData = { user: User }

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // GET /auth/me: app khulte hi pata karo ke user login hai ya nahi.
    me: build.query<ApiSuccess<UserData>, void>({
      query: () => '/auth/me',
      providesTags: ['Me'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(setUser(data.data.user))
        } catch {
          dispatch(clearUser())
        }
      },
    }),

    signup: build.mutation<
      ApiSuccess<UserData & { emailSent: boolean }>,
      { name: string; email: string; password: string }
    >({
      query: (body) => ({ url: '/auth/signup', method: 'POST', body }),
    }),

    verifyEmail: build.mutation<ApiSuccess<UserData>, { token: string }>({
      query: (body) => ({ url: '/auth/verify-email', method: 'POST', body }),
    }),

    resendVerification: build.mutation<ApiSuccess<null>, { email: string }>({
      query: (body) => ({ url: '/auth/resend-verification', method: 'POST', body }),
    }),

    login: build.mutation<
      ApiSuccess<UserData & { accessTokenExpiresIn: number }>,
      { email: string; password: string }
    >({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(setUser(data.data.user))
        } catch {
          // Ghalti page par dikhayi jayegi.
        }
      },
    }),

    logout: build.mutation<ApiSuccess<null>, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled
        } finally {
          dispatch(clearUser())
          dispatch(baseApi.util.resetApiState())
        }
      },
    }),

    logoutAll: build.mutation<ApiSuccess<{ sessionsEnded: number }>, void>({
      query: () => ({ url: '/auth/logout-all', method: 'POST' }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled
        } finally {
          dispatch(clearUser())
          dispatch(baseApi.util.resetApiState())
        }
      },
    }),

    forgotPassword: build.mutation<ApiSuccess<{ expiresInSeconds: number }>, { email: string }>({
      query: (body) => ({ url: '/auth/forgot-password', method: 'POST', body }),
    }),

    verifyOtp: build.mutation<
      ApiSuccess<{ resetToken: string; expiresInSeconds: number }>,
      { email: string; otp: string }
    >({
      query: (body) => ({ url: '/auth/verify-otp', method: 'POST', body }),
    }),

    resetPassword: build.mutation<
      ApiSuccess<null>,
      { resetToken: string; password: string; confirmPassword: string }
    >({
      query: (body) => ({ url: '/auth/reset-password', method: 'POST', body }),
    }),
  }),
})

export const {
  useMeQuery,
  useSignupMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useLoginMutation,
  useLogoutMutation,
  useLogoutAllMutation,
  useForgotPasswordMutation,
  useVerifyOtpMutation,
  useResetPasswordMutation,
} = authApi
