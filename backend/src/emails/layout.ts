import { env } from '../config/env.js';

// Every e-mail has a subject, a plain-text version and an HTML version.
export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

// Escapes a value before it goes into HTML, so a name like "<b>Ali</b>" shows as text.
export function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// The same frame around every e-mail: a centred box and the app name at the bottom.
export function layout(body: string): string {
  return (
    '<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0f172a">' +
    body +
    `<p style="color:#64748b;font-size:12px;margin-top:32px">${esc(env.appName)}</p>` +
    '</div>'
  );
}
