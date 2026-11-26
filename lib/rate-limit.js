/**
 * Fixed-window, in-memory rate limiter.
 *
 * @param {{windowMs: number, maxRequests: number, maxTrackedClients: number}} options
 * @param {() => number} [now]  Injectable clock, for tests.
 * @returns {(clientId: string) => boolean} True when the client is over the limit.
 */
export function createRateLimiter({ windowMs, maxRequests, maxTrackedClients }, now = Date.now) {
  let counts = new Map();
  let windowStart = now();

  return function isLimited(clientId) {
    const current = now();
    if (current - windowStart >= windowMs) {
      counts = new Map();
      windowStart = current;
    }
    // Bound memory: if too many distinct clients show up, start a fresh table.
    if (counts.size >= maxTrackedClients && !counts.has(clientId)) counts.clear();

    const count = (counts.get(clientId) ?? 0) + 1;
    counts.set(clientId, count);
    return count > maxRequests;
  };
}
