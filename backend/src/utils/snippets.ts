// The install snippets. The ONLY place they are written: the dashboard shows what this returns.

export interface Snippet {
  id: 'script-tag' | 'custom-event';
  label: string;
  language: 'html';
  code: string;
  note: string;
}

/** Makes tw() safe to call at any time, even before tw.js has loaded (calls are queued). */
export const TW_STUB = '<script>window.tw=window.tw||function(){(tw.q=tw.q||[]).push(arguments)}</script>';

export function snippetsFor(collectorUrl: string, publicKey: string): Snippet[] {
  const tag = `<script async fetchpriority="low" src="${collectorUrl}/tw.js?id=${publicKey}"></script>`;
  return [
    {
      id: 'script-tag',
      label: 'Script tag',
      language: 'html',
      code: tag,
      note: 'Paste it inside <head> on every page (in most sites: once, in the layout or theme header). Page views, including single-page app navigation, are tracked automatically.',
    },
    {
      id: 'custom-event',
      label: 'Custom events',
      language: 'html',
      code:
        `<!-- 1. Once, in <head>, right below the TailWatch script: makes tw() safe to call at any time -->\n${TW_STUB}\n\n` +
        `<!-- 2a. Count clicks on a button or link -->\n<button onclick="tw('track', 'signup_click')">Sign up</button>\n\n` +
        `<!-- 2b. Or from your own JavaScript, with details -->\n<script>\n  tw('track', 'purchase', { plan: 'pro', amount: 49 });\n</script>`,
      note:
        'Event names: lowercase letters, digits and _ (up to 40), not starting with tw_. Up to 25 details per event (text, numbers or true/false). ' +
        'Never send personal data such as e-mail addresses or phone numbers. A new event shows up on the Events page with its first hit.',
    },
  ];
}
