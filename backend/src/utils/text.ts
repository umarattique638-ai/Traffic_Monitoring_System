// Small wording helpers for the activity log and e-mails.

export const dayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });

/** count(2, 'site') -> "2 sites". */
export const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/** "5 hours", "2 days". */
export function spanText(ms: number): string {
  const h = Math.max(1, Math.round(ms / 3_600_000));
  if (h < 48) return `${h} hour${h === 1 ? '' : 's'}`;
  return `${Math.round(h / 24)} days`;
}

/** The message of any thrown value, short enough for a log line. */
export const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 300);
