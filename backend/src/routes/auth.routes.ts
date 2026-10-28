import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import {
  forgotPasswordLimiter,
  loginLimiter,
  refreshLimiter,
  resendVerificationLimiter,
  resetPasswordLimiter,
  signupLimiter,
  verifyEmailLimiter,
  verifyOtpLimiter,
} from '../middlewares/rateLimit.middleware.js';

const router = Router();

// Account and e-mail verification
router.post('/signup', signupLimiter, authController.signup);
router.post('/verify-email', verifyEmailLimiter, authController.verifyEmail);
router.post('/resend-verification', resendVerificationLimiter, authController.resendVerification);

// Login session: access token + refresh token
router.post('/login', loginLimiter, authController.login);
router.post('/refresh', refreshLimiter, authController.refresh);
router.post('/logout', authController.logout);
router.post('/logout-all', requireAuth, authController.logoutAll);
router.get('/me', requireAuth, authController.me);

// Forgot password: OTP → reset token → new password
router.post('/forgot-password', forgotPasswordLimiter, authController.forgotPassword);
router.post('/verify-otp', verifyOtpLimiter, authController.verifyOtp);
router.post('/reset-password', resetPasswordLimiter, authController.resetPassword);

export default router;
