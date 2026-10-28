import bcrypt from 'bcryptjs';
import {
  RESET_OTP_MAX_ATTEMPTS,
  RESET_OTP_TTL_MS,
  RESET_TOKEN_TTL_MS,
  SALT_ROUNDS,
} from '../config/auth.constants.js';
import { emailTemplates } from '../emails/templates.js';
import { User } from '../models/user.model.js';
import { AppError } from '../utils/AppError.js';
import { generateOtp, hashToken, randomToken, safeEqual } from '../utils/crypto.js';
import { auditService } from './audit.service.js';
import { mailService } from './mail.service.js';
import { sessionService } from './session.service.js';
import { tokenService } from './token.service.js';

const invalidOtp = () =>
  AppError.badRequest('The code is wrong or has expired. Ask for a new one.', 'invalid_otp');
const resetExpired = () =>
  AppError.badRequest('This reset session has expired. Please start again.', 'invalid_reset_token');

// Forgot password in three steps: e-mail a code → exchange the code for a reset token → set the new password.
export const passwordService = {
  // Step 1: e-mail a 6-digit code (valid 1 minute, one use).
  async forgot(email: string): Promise<void> {
    const user = await User.findOne({ email });
    if (!user) throw AppError.notFound('No account uses this email.', 'email_not_found');

    await tokenService.assertCooldown(user._id, 'reset_otp');
    const otp = generateOtp();
    await tokenService.issue(user._id, 'reset_otp', otp, RESET_OTP_TTL_MS);

    try {
      await mailService.send(user.email, emailTemplates.resetOtp(user.name, otp));
    } catch (err) {
      // No e-mail means the code is useless: remove it so the user can ask again right away.
      await tokenService.remove(user._id, 'reset_otp');
      console.error('Reset email failed:', err);
      throw new AppError(502, 'email_failed', 'We could not send the email. Please try again.');
    }
  },

  // Step 2: a correct code is deleted and exchanged for a reset token (10 minutes, one use).
  async verifyOtp(email: string, otp: string): Promise<string> {
    const user = await User.findOne({ email });
    if (!user) throw invalidOtp();
    const record = await tokenService.findActive(user._id, 'reset_otp');
    if (!record) throw invalidOtp();

    if (!safeEqual(record.hash, hashToken(otp))) {
      record.attempts += 1;
      if (record.attempts >= RESET_OTP_MAX_ATTEMPTS) {
        await record.deleteOne();
        throw AppError.tooManyRequests('Too many wrong codes. Ask for a new one.', 'too_many_attempts');
      }
      await record.save();
      const left = RESET_OTP_MAX_ATTEMPTS - record.attempts;
      throw AppError.badRequest(
        `The code is wrong. ${left} ${left === 1 ? 'try' : 'tries'} left.`,
        'invalid_otp',
      );
    }

    // Delete first; if two requests race with the same code, only the one that deleted it goes on.
    const { deletedCount } = await record.deleteOne();
    if (deletedCount !== 1) throw invalidOtp();

    const resetToken = randomToken();
    await tokenService.issue(user._id, 'reset_password', resetToken, RESET_TOKEN_TTL_MS);
    return resetToken;
  },

  // Step 3: the reset token sets the new password and ends every session (every device).
  async reset(resetToken: string, newPassword: string): Promise<void> {
    const record = await tokenService.consume('reset_password', resetToken);
    if (!record) throw resetExpired();

    const user = await User.findById(record.userId);
    if (!user) throw resetExpired();

    user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    user.passwordChangedAt = new Date();
    // The code reached this inbox, so the e-mail address is proven too.
    if (!user.isEmailVerified) {
      user.isEmailVerified = true;
      user.emailVerifiedAt = new Date();
    }
    await user.save();

    // Log out everywhere, and remove any other reset codes still around.
    await sessionService.revokeAll(user._id, 'password_reset');
    await tokenService.remove(user._id, 'reset_otp');
    await auditService.record(user, 'auth.password_reset', null, 'Reset the password with an e-mailed code (logged out everywhere)');

    // Not awaited: the answer does not wait for this e-mail.
    mailService.send(user.email, emailTemplates.passwordChanged(user.name)).catch((err: unknown) => {
      console.error('Password changed email failed:', err);
    });
  },
};
