import { z } from 'zod';

const JSON_BODY = { error: 'Send the fields as a JSON body.' };

const email = z
  .string({ error: 'Email is required.' })
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address.'));

// bcrypt only uses the first 72 bytes of a password, so we cap it there.
const newPassword = z
  .string({ error: 'Password is required.' })
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be at most 72 characters.');

// Long random values from links (verification link, reset token).
const linkToken = z
  .string({ error: 'Token is required.' })
  .trim()
  .min(20, 'Token is not valid.')
  .max(200, 'Token is not valid.');

export const signupSchema = z.object(
  {
    name: z
      .string({ error: 'Name is required.' })
      .trim()
      .min(2, 'Name must be at least 2 characters.')
      .max(50, 'Name must be at most 50 characters.'),
    email,
    password: newPassword,
  },
  JSON_BODY,
);

// Login does not repeat the signup rules: it only checks that something was typed.
export const loginSchema = z.object(
  {
    email,
    password: z
      .string({ error: 'Password is required.' })
      .min(1, 'Password is required.')
      .max(72, 'Password must be at most 72 characters.'),
  },
  JSON_BODY,
);

// forgot-password and resend-verification only need an e-mail.
export const emailSchema = z.object({ email }, JSON_BODY);

export const verifyEmailSchema = z.object({ token: linkToken }, JSON_BODY);

export const verifyOtpSchema = z.object(
  {
    email,
    otp: z
      .string({ error: 'Code is required.' })
      .trim()
      .regex(/^\d{6}$/, 'The code has 6 digits.'),
  },
  JSON_BODY,
);

export const resetPasswordSchema = z
  .object(
    {
      resetToken: linkToken,
      password: newPassword,
      confirmPassword: z.string({ error: 'Please confirm the password.' }),
    },
    JSON_BODY,
  )
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
