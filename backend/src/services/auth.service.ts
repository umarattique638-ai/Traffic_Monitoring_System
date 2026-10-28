import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { SALT_ROUNDS, VERIFY_EMAIL_TTL_MS } from '../config/auth.constants.js';
import { env } from '../config/env.js';
import { emailTemplates } from '../emails/templates.js';
import { User } from '../models/user.model.js';
import type { UserDocument } from '../models/user.model.js';
import type { AuthTokens, ClientInfo } from '../types/auth.types.js';
import { AppError } from '../utils/AppError.js';
import { randomToken } from '../utils/crypto.js';
import { isDuplicateKeyError } from '../utils/mongoErrors.js';
import type { LoginInput, SignupInput } from '../validators/auth.validator.js';
import { auditService } from './audit.service.js';
import { mailService } from './mail.service.js';
import { sessionService } from './session.service.js';
import { tokenService } from './token.service.js';

// Compared against when the email does not exist, so a wrong email takes as long as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', SALT_ROUNDS);

const emailTaken = () => AppError.conflict('This email is already registered.', 'email_taken');
const invalidLink = () =>
  AppError.badRequest(
    'This verification link is invalid or has expired. Ask for a new one.',
    'invalid_token',
  );

// Link in the e-mail. It opens the frontend page, which calls POST /auth/verify-email.
function verifyLink(token: string): string {
  const base = env.clientUrl.split(',')[0]!.trim();
  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
}

// Makes a new verification token, saves its hash, and e-mails the link.
async function sendVerificationEmail(user: UserDocument): Promise<void> {
  const token = randomToken();
  await tokenService.issue(user._id, 'email_verify', token, VERIFY_EMAIL_TTL_MS);
  await mailService.send(user.email, emailTemplates.verifyEmail(user.name, verifyLink(token)));
}

export const authService = {
  // Creates the account (not verified yet) and e-mails the verification link.
  async signup(input: SignupInput): Promise<{ user: UserDocument; emailSent: boolean }> {
    if (await User.exists({ email: input.email })) throw emailTaken();

    const hash = await bcrypt.hash(input.password, SALT_ROUNDS);
    let user: UserDocument;
    try {
      user = await User.create({ name: input.name, email: input.email, password: hash });
    } catch (err) {
      // Two signups with the same email at the same moment: the unique index stops the second one.
      if (isDuplicateKeyError(err)) throw emailTaken();
      throw err;
    }

    await auditService.record(user, 'account.created', null, `Created the account ${user.email}`);

    // The account exists even if the e-mail fails; the user can ask for it again.
    try {
      await sendVerificationEmail(user);
      return { user, emailSent: true };
    } catch (err) {
      console.error('Verification email failed:', err);
      return { user, emailSent: false };
    }
  },

  // The link from the e-mail. It works once, for 24 hours.
  async verifyEmail(token: string): Promise<UserDocument> {
    const record = await tokenService.consume('email_verify', token);
    if (!record) throw invalidLink();

    const user = await User.findById(record.userId);
    if (!user) throw invalidLink();

    if (!user.isEmailVerified) {
      user.isEmailVerified = true;
      user.emailVerifiedAt = new Date();
      await user.save();
      await auditService.record(user, 'auth.email_verified', null, `Verified the e-mail address ${user.email}`);
    }
    return user;
  },

  // Sends the verification e-mail again. Says nothing about whether the e-mail exists.
  async resendVerification(email: string): Promise<void> {
    const user = await User.findOne({ email });
    if (!user || user.isEmailVerified) return;
    await tokenService.assertCooldown(user._id, 'email_verify');
    await sendVerificationEmail(user);
  },

  // Checks the password, then starts a session: an access token and a refresh token.
  async login(input: LoginInput, client: ClientInfo): Promise<{ user: UserDocument; tokens: AuthTokens }> {
    const user = await User.findOne({ email: input.email }).select('+password');
    const ok = await bcrypt.compare(input.password, user?.password ?? DUMMY_HASH);

    // Same answer for "no such email" and "wrong password", so nobody can find out who is registered.
    if (!user || !ok) throw AppError.unauthorized('Email or password is incorrect.', 'invalid_credentials');

    // Only after the right password, so this does not reveal anything to a stranger.
    if (!user.isEmailVerified) {
      throw AppError.forbidden(
        'Please verify your email first. Check your inbox for the link.',
        'email_not_verified',
      );
    }
    if (user.isBlocked) {
      throw AppError.forbidden('Your account has been blocked. Please contact support.', 'account_blocked');
    }

    // E-mails in SUPER_ADMIN_EMAILS become super admins (only after the e-mail is verified).
    if (env.superAdminEmails.includes(user.email) && user.role !== 'super_admin') {
      user.role = 'super_admin';
      await user.save();
    }

    const tokens = await sessionService.create(user, client);
    await auditService.record(user, 'auth.login', null, 'Logged in');
    return { user, tokens };
  },

  // The logged-in user. Null when the account was deleted or blocked.
  async getActiveUser(userId: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    const user = await User.findById(userId);
    return user && !user.isBlocked ? user : null;
  },
};
