import { rateLimit } from 'express-rate-limit';
import { ApiResponse } from '../utils/ApiResponse.js';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// Each limiter keeps its own count per IP, so every route gets its own budget.
function limiter(limit: number, message: string, code = 'too_many_attempts') {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      ApiResponse.error(res, 429, code, message);
    },
  });
}

const WAIT = 'Please wait 15 minutes and try again.';

// Every API request. The dashboard polls (live visitors every few seconds), so this is generous;
// the auth routes below have their own, much smaller budgets.
export const apiLimiter = limiter(1500, 'Too many requests. Please try again later.', 'too_many_requests');

// Auth routes, per 15 minutes per IP.
export const signupLimiter = limiter(5, `Too many signups from this network. ${WAIT}`);
export const verifyEmailLimiter = limiter(10, `Too many attempts. ${WAIT}`);
export const resendVerificationLimiter = limiter(5, `Too many emails requested. ${WAIT}`);
export const loginLimiter = limiter(10, `Too many login attempts. ${WAIT}`);
// A browser refreshes about every 15 minutes per tab; 60 leaves room for many tabs.
export const refreshLimiter = limiter(60, `Too many refresh attempts. ${WAIT}`);
export const forgotPasswordLimiter = limiter(5, `Too many emails requested. ${WAIT}`);
export const verifyOtpLimiter = limiter(10, `Too many attempts. ${WAIT}`);
export const resetPasswordLimiter = limiter(10, `Too many attempts. ${WAIT}`);

// Traffic monitoring: adding a site and the install check open the customer's website.
export const setupLimiter = limiter(30, `Too many site checks. ${WAIT}`);
