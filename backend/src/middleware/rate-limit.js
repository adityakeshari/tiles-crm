// Minimal, dependency-free, in-memory rate limiter.
//
// Scope/limitations: counts are per Node process and reset on restart. This is
// sufficient for the current single-process deployment. If the app is ever run
// clustered or behind multiple instances, replace the in-memory Map with a
// shared store (e.g. Redis) so limits are enforced globally.
//
// `req.ip` is trusted because app.js sets `app.set("trust proxy", 1)`.

export function createRateLimiter({ windowMs, max, message } = {}) {
  const limitWindowMs = Number(windowMs) || 15 * 60 * 1000;
  const maxRequests = Number(max) || 10;
  const hits = new Map(); // key -> { count, resetAt }

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const key = String(req.ip || req.connection?.remoteAddress || "unknown");

    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + limitWindowMs };
      hits.set(key, entry);
    }

    entry.count += 1;

    // Opportunistic cleanup to bound memory growth.
    if (hits.size > 5000) {
      for (const [k, v] of hits) {
        if (v.resetAt <= now) {
          hits.delete(k);
        }
      }
    }

    if (entry.count > maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.set("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        message: message || "Too many requests. Please try again later.",
      });
    }

    return next();
  };
}
