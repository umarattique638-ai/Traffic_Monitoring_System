import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { User } from '../../types/api'

// checking: app khuli hai, abhi /auth/me ka jawab nahi aaya
// authenticated: user login hai · guest: login nahi
type AuthStatus = 'checking' | 'authenticated' | 'guest'

interface AuthState {
  user: User | null
  status: AuthStatus
  // Forgot password ke pages ke beech email aur reset token yahan rehte hain (sirf memory mein).
  resetEmail: string | null
  resetToken: string | null
}

const initialState: AuthState = {
  user: null,
  status: 'checking',
  resetEmail: null,
  resetToken: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload
      state.status = 'authenticated'
    },
    clearUser(state) {
      state.user = null
      state.status = 'guest'
    },
    setResetEmail(state, action: PayloadAction<string>) {
      state.resetEmail = action.payload
      state.resetToken = null
    },
    setResetToken(state, action: PayloadAction<string>) {
      state.resetToken = action.payload
    },
    clearReset(state) {
      state.resetEmail = null
      state.resetToken = null
    },
  },
})

export const { setUser, clearUser, setResetEmail, setResetToken, clearReset } = authSlice.actions
export default authSlice.reducer
