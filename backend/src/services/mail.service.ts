import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import type { EmailContent } from '../emails/layout.js';

// One SMTP connection for the whole app. Without SMTP_HOST (development) there is none.
const transporter = env.smtp.host
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    })
  : null;

export const mailService = {
  // Sends an e-mail. In development (no SMTP) it prints the e-mail in the terminal instead.
  async send(to: string, content: EmailContent): Promise<void> {
    if (!transporter) {
      console.log(
        `\n--- EMAIL to ${to} ---\nSubject: ${content.subject}\n\n${content.text}\n--- END EMAIL ---\n`,
      );
      return;
    }
    await transporter.sendMail({
      from: env.mailFrom,
      to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
  },
};
