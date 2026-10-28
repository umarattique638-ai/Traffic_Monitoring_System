// Backend ka har jawab in do mein se ek shakal ka hota hai (backend ka ApiResponse).
export interface ApiSuccess<T> {
  success: true
  message: string
  data: T
}

export interface ApiErrorBody {
  success: false
  error: {
    code: string
    message: string
    details?: { field: string; message: string }[]
  }
}

// Backend ka UserDTO.
export type Role = 'admin' | 'super_admin'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  isEmailVerified: boolean
  createdAt: string
}

// Super admin ko har user ki zyada maloomat milti hai (backend ka AdminUserDTO).
export interface AdminUser extends User {
  isBlocked: boolean
  blockedAt: string | null
  blockedReason: string | null
  isProtected: boolean
  updatedAt: string
}
