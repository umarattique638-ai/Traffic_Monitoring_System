/**
 * Fixed-window counters in memory, for work that is expensive for OTHER people's servers (the install
 * check opens the customer's website). One per server instance; express-rate-limit guards the routes.
 */
export class Limiter {
  private hits = new Map<string, { n: number; until: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Counts one attempt for `key`; false once the window's allowance is used up. */
  take(key: string): boolean {
    const now = Date.now();
    const h = this.hits.get(key);
    if (!h || h.until <= now) {
      if (this.hits.size > 10_000) this.hits.clear();
      this.hits.set(key, { n: 1, until: now + this.windowMs });
      return true;
    }
    h.n += 1;
    return h.n <= this.max;
  }
}

const MIN = 60_000;

export const limits = {
  // The install check: a few per minute per account and per client address.
  verify: new Limiter(20, 10 * MIN),
  verifyIp: new Limiter(40, 10 * MIN),
  // Site health when the dashboard opens (re-checked at most hourly per site anyway).
  health: new Limiter(60, 60 * MIN),
  // "Check again" on the health banner (it opens the customer's site).
  healthCheck: new Limiter(10, 10 * MIN),
  // Password checks of "Delete account".
  deleteAccount: new Limiter(5, 15 * MIN),
};
