const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

// E-mail verification link after signup.
export const VERIFY_EMAIL_TTL_MS = 24 * HOUR;

// Forgot password: the OTP is valid for 1 minute and can be tried 5 times.
export const RESET_OTP_TTL_MS = 1 * MINUTE;
export const RESET_OTP_MAX_ATTEMPTS = 5;

// After a correct OTP, the user has 10 minutes to choose a new password.
export const RESET_TOKEN_TTL_MS = 10 * MINUTE;

// Wait at least this long before sending the same kind of e-mail again.
export const RESEND_COOLDOWN_MS = 1 * MINUTE;

// bcrypt work factor: each +1 doubles the time to hash (and to guess) a password.
export const SALT_ROUNDS = 12;
