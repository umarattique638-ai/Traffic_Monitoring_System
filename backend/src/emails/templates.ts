import { env } from '../config/env.js';
import { esc, layout } from './layout.js';
import type { EmailContent } from './layout.js';

const hello = (name: string | null) => (name ? `Hi ${name},` : 'Hi,');
const paragraphs = (lines: string[]) => lines.map((l) => `<p>${esc(l)}</p>`).join('');
const muted = (lines: string[]) => lines.map((l) => `<p style="color:#64748b;font-size:13px">${esc(l)}</p>`).join('');
const n = (v: number) => Math.round(v).toLocaleString('en-US');

export interface SpikeInfo {
  pageviews: number;
  usual: number;
  times: number;
}

export interface SpikeBreakdown {
  pages: { label: string; count: number }[];
  countries: { label: string; count: number }[];
  referrers: { label: string; count: number }[];
  blocked: number;
}

const BUTTON =
  'display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none';

// Every e-mail the app sends, in one place.
export const emailTemplates = {
  // Sent after signup. The link opens our frontend, which confirms the e-mail with the backend.
  verifyEmail(name: string, link: string): EmailContent {
    return {
      subject: `Verify your email for ${env.appName}`,
      text:
        `Hi ${name},\n\nPlease verify your email by opening this link:\n${link}\n\n` +
        'The link works for 24 hours. If you did not sign up, ignore this email.',
      html: layout(
        `<p>Hi ${esc(name)},</p>` +
          '<p>Please verify your email to finish creating your account.</p>' +
          `<p><a href="${esc(link)}" style="${BUTTON}">Verify email</a></p>` +
          '<p style="color:#64748b;font-size:13px">The link works for 24 hours.</p>',
      ),
    };
  },

  // Forgot password, step 1: the 6-digit code.
  resetOtp(name: string, otp: string): EmailContent {
    return {
      subject: `Your ${env.appName} password reset code`,
      text:
        `Hi ${name},\n\nYour password reset code is: ${otp}\n\n` +
        'It expires in 1 minute and works only once. If you did not ask for it, ignore this email.',
      html: layout(
        `<p>Hi ${esc(name)},</p>` +
          '<p>Your password reset code is:</p>' +
          `<p style="font-size:28px;font-weight:bold;letter-spacing:6px">${esc(otp)}</p>` +
          '<p style="color:#64748b;font-size:13px">It expires in 1 minute and works only once.</p>',
      ),
    };
  },

  // After a password reset: a warning, in case it was not the owner.
  passwordChanged(name: string): EmailContent {
    return {
      subject: `Your ${env.appName} password was changed`,
      text:
        `Hi ${name},\n\nYour password was just changed and you were logged out everywhere. ` +
        'If this was not you, reset your password now.',
      html: layout(
        `<p>Hi ${esc(name)},</p>` +
          '<p>Your password was just changed and you were logged out on every device.</p>' +
          '<p style="color:#64748b;font-size:13px">If this was not you, reset your password now.</p>',
      ),
    };
  },

  // A site went silent and its install check fails. Sent once per outage.
  siteBroken(name: string | null, domain: string, silence: string, reason: string, link: string): EmailContent {
    const lines = [
      `${hello(name)} we have received no data from ${domain} for ${silence}.`,
      `We looked into why. What we found: ${reason}`,
      'Until this is fixed, visits to the site are not counted. Open the dashboard to see the details, copy the script again and run the check.',
    ];
    const after = ['We send this once. When data arrives again, you get one short e-mail saying so.'];
    return {
      subject: `${domain} stopped sending data`,
      text: [...lines, link, ...after].join('\n\n'),
      html: layout(paragraphs(lines) + `<p><a href="${esc(link)}" style="${BUTTON}">Open the dashboard</a></p>` + muted(after)),
    };
  },

  // Data arrives again from a site we e-mailed about.
  siteRecovered(name: string | null, domain: string, link: string): EmailContent {
    const lines = [`${hello(name)} good news: ${domain} is sending data again, and visits are being counted.`, 'Nothing else to do.'];
    return {
      subject: `${domain} is sending data again`,
      text: [...lines, link].join('\n\n'),
      html: layout(paragraphs(lines) + `<p><a href="${esc(link)}" style="${BUTTON}">Open the dashboard</a></p>`),
    };
  },

  // Far more traffic than usual in the last 24 hours, and where it came from.
  siteSpike(name: string | null, domain: string, spike: SpikeInfo, details: SpikeBreakdown, link: string): EmailContent {
    const list = (rows: { label: string; count: number }[], empty: string) => (rows.length ? rows.map((r) => `${r.label || empty} (${n(r.count)})`).join(', ') : '-');
    const usual =
      spike.usual >= 1 ? `about ${spike.times >= 10 ? Math.round(spike.times) : spike.times.toFixed(1)} times its usual ${n(spike.usual)} a day` : 'while it usually gets almost none';
    const lines = [
      `${hello(name)} ${domain} had ${n(spike.pageviews)} page views in the last 24 hours, ${usual}.`,
      `Top pages: ${list(details.pages, '/')}.`,
      `Top countries: ${list(details.countries, 'unknown')}.`,
      `Top referrers: ${list(details.referrers, 'direct')}.`,
      details.blocked > 0
        ? `In the same 24 hours we blocked ${n(details.blocked)} hits (bots, other websites using your key). Those are not in the numbers above.`
        : 'We blocked no hits in the same 24 hours, so this looks like real visitors.',
    ];
    return {
      subject: `Unusual traffic on ${domain}: ${n(spike.pageviews)} page views in 24 hours`,
      text: [...lines, link, 'At most one such e-mail a day.'].join('\n\n'),
      html: layout(paragraphs(lines) + `<p><a href="${esc(link)}" style="${BUTTON}">Open the dashboard</a></p>` + muted(['At most one such e-mail a day.'])),
    };
  },

  // Most sites went silent at once: that is the pipeline, not the customers. Only the operator hears.
  pipelineSilent(silent: number, total: number, domains: string[]): EmailContent {
    const lines = [
      `${silent} of ${total} active sites have sent no data for longer than usual. That many at once points at the pipeline (collector, queue, consumer or ClickHouse), not at the sites.`,
      'No customer was e-mailed about it. Check the collector and consumer logs in Cloudflare, and the ClickHouse service.',
      `Silent: ${domains.slice(0, 20).join(', ')}${domains.length > 20 ? `, and ${domains.length - 20} more` : ''}.`,
    ];
    return { subject: `${env.appName}: ${silent} of ${total} sites are silent`, text: lines.join('\n\n'), html: layout(paragraphs(lines)) };
  },

  // The account was deleted (by its owner or a super admin).
  accountDeleted(name: string | null, sites: number, settleDays: number, byTeam: boolean): EmailContent {
    const lines = [
      byTeam ? `${hello(name)} your ${env.appName} account was deleted just now by an administrator.` : `${hello(name)} your ${env.appName} account was deleted just now.`,
      `Your login, ${sites === 1 ? 'site' : `${sites} sites`}, saved reports and activity log are gone. Tracking stopped: the collector no longer accepts your site keys.`,
      `The analytics your sites collected are being erased in the background. This finishes within ${settleDays + 1} days, and we send one more e-mail when it is done.`,
      byTeam ? 'If this is a surprise, reply to this e-mail at once.' : 'If you did not do this, reply to this e-mail at once.',
    ];
    return { subject: `Your ${env.appName} account was deleted`, text: lines.join('\n\n'), html: layout(paragraphs(lines)) };
  },

  // Every row of the account's sites is gone (verified by a count). The last e-mail we send.
  erasureDone(name: string | null, rows: number, watchDays: number): EmailContent {
    const lines = [
      `${hello(name)} the erasure of your ${env.appName} data is complete.`,
      `We deleted the analytics of your sites (${n(rows)} stored rows) and checked that nothing is left in our database.`,
      `For the next ${watchDays} days we keep checking, in case a delayed event still arrives, and delete it too.`,
      'We have deleted your e-mail address as well: this is the last message you get from us.',
    ];
    return { subject: `Your ${env.appName} data has been erased`, text: lines.join('\n\n'), html: layout(paragraphs(lines)) };
  },
};
