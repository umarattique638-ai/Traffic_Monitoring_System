import type { Request, Response } from 'express';
import { toUserDTO } from '../dtos/user.dto.js';
import { auditService } from '../services/audit.service.js';
import { authService } from '../services/auth.service.js';
import { passwordService } from '../services/password.service.js';
import { sessionService } from '../services/session.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { AppError } from '../utils/AppError.js';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  readCookie,
  setAccessCookie,
  setAuthCookies,
} from '../utils/cookie.js';
import { ACCESS_TOKEN_SECONDS, readAccessTokenIgnoringExpiry } from '../utils/jwt.js';
import {
  emailSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  verifyEmailSchema,
  verifyOtpSchema,
} from '../validators/auth.validator.js';

// Routes behind requireAuth: req.auth is the logged-in user.
function userIdOf(req: Request): string {
  if (!req.auth) throw AppError.unauthorized();
  return req.auth.userId;
}

// Every controller: validate the request → call a service → send the answer (and set cookies).
export const authController = {
  // POST /api/v1/auth/signup   { name, email, password }
  async signup(req: Request, res: Response): Promise<void> {
    const input = signupSchema.parse(req.body);
    const { user, emailSent } = await authService.signup(input);
    const message = emailSent
      ? 'Account created. Check your email to verify it.'
      : 'Account created, but we could not send the verification email. Ask for a new one.';
    ApiResponse.created(res, { user: toUserDTO(user), emailSent }, message);
  },

  // POST /api/v1/auth/verify-email   { token }
  async verifyEmail(req: Request, res: Response): Promise<void> {
    const { token } = verifyEmailSchema.parse(req.body);
    const user = await authService.verifyEmail(token);
    ApiResponse.ok(res, { user: toUserDTO(user) }, 'Email verified. You can log in now.');
  },

  // POST /api/v1/auth/resend-verification   { email }
  async resendVerification(req: Request, res: Response): Promise<void> {
    const { email } = emailSchema.parse(req.body);
    await authService.resendVerification(email);
    ApiResponse.ok(res, null, 'If this email needs verifying, a new link is on its way.');
  },

  // POST /api/v1/auth/login   { email, password }  → sets the two cookies
  async login(req: Request, res: Response): Promise<void> {
    const input = loginSchema.parse(req.body);
    const { user, tokens } = await authService.login(input, {
      userAgent: req.get('user-agent') ?? '',
      ip: req.ip ?? '',
    });
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken!);
    ApiResponse.ok(res, { user: toUserDTO(user), accessTokenExpiresIn: ACCESS_TOKEN_SECONDS }, 'Logged in.');
  },

  // POST /api/v1/auth/refresh   New access token (and a new refresh token) from the refresh token cookie.
  async refresh(req: Request, res: Response): Promise<void> {
    const refreshToken = readCookie(req, REFRESH_COOKIE);
    if (!refreshToken) throw AppError.unauthorized('Please log in to continue.', 'no_refresh_token');

    try {
      const tokens = await sessionService.refresh(refreshToken);
      if (tokens.refreshToken) setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      else setAccessCookie(res, tokens.accessToken);
      ApiResponse.ok(res, { accessTokenExpiresIn: ACCESS_TOKEN_SECONDS }, 'Session refreshed.');
    } catch (err) {
      // The login is over: remove both cookies so the browser stops sending them.
      clearAuthCookies(res);
      throw err;
    }
  },

  // GET /api/v1/auth/me   (behind requireAuth) Who is logged in?
  async me(req: Request, res: Response): Promise<void> {
    const user = await authService.getActiveUser(userIdOf(req));
    if (!user) throw AppError.unauthorized();
    ApiResponse.ok(res, { user: toUserDTO(user) });
  },

  // POST /api/v1/auth/logout   Ends this device's session. Works even with an expired access token.
  async logout(req: Request, res: Response): Promise<void> {
    const refreshToken = readCookie(req, REFRESH_COOKIE);
    const accessToken = readCookie(req, ACCESS_COOKIE);

    // Which session? From the refresh token first, else from the (maybe expired) access token.
    const sessionId =
      (refreshToken && (await sessionService.findIdByRefreshToken(refreshToken))) ||
      (accessToken && readAccessTokenIgnoringExpiry(accessToken)?.sessionId) ||
      null;
    if (sessionId) await sessionService.revoke(sessionId);

    // A line in the activity log, when we can tell who it was.
    const userId = accessToken ? readAccessTokenIgnoringExpiry(accessToken)?.userId : undefined;
    const user = userId ? await authService.getActiveUser(userId) : null;
    if (user) await auditService.record(user, 'auth.logout', null, 'Logged out');

    clearAuthCookies(res);
    ApiResponse.ok(res, null, 'Logged out.');
  },

  // POST /api/v1/auth/logout-all   (behind requireAuth) Logs out on every device.
  async logoutAll(req: Request, res: Response): Promise<void> {
    const ended = await sessionService.revokeAll(userIdOf(req), 'logout_all');
    clearAuthCookies(res);
    ApiResponse.ok(res, { sessionsEnded: ended }, 'Logged out on every device.');
  },

  // POST /api/v1/auth/forgot-password   { email }
  async forgotPassword(req: Request, res: Response): Promise<void> {
    const { email } = emailSchema.parse(req.body);
    await passwordService.forgot(email);
    ApiResponse.ok(
      res,
      { expiresInSeconds: 60 },
      'We sent a 6-digit code to your email. It expires in 1 minute.',
    );
  },

  // POST /api/v1/auth/verify-otp   { email, otp }  → resetToken
  async verifyOtp(req: Request, res: Response): Promise<void> {
    const { email, otp } = verifyOtpSchema.parse(req.body);
    const resetToken = await passwordService.verifyOtp(email, otp);
    ApiResponse.ok(res, { resetToken, expiresInSeconds: 600 }, 'Code verified. Choose a new password.');
  },

  // POST /api/v1/auth/reset-password   { resetToken, password, confirmPassword }
  async resetPassword(req: Request, res: Response): Promise<void> {
    const { resetToken, password } = resetPasswordSchema.parse(req.body);
    await passwordService.reset(resetToken, password);
    // Every session was ended; this browser's cookies go too.
    clearAuthCookies(res);
    ApiResponse.ok(res, null, 'Password changed. Please log in with your new password.');
  },
};
