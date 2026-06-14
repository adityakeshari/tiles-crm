// Baseline security response headers (a dependency-free subset of what `helmet`
// would set). Kept conservative so it does not interfere with the same-origin
// SPA, static assets, or CORS preflight handling.

export function securityHeaders(_req, res, next) {
  // Stop browsers from MIME-sniffing responses away from the declared type.
  res.set("X-Content-Type-Options", "nosniff");
  // This CRM is never meant to be embedded in another site.
  res.set("X-Frame-Options", "DENY");
  // Don't leak full URLs (which may carry ids) to other origins via Referer.
  res.set("Referrer-Policy", "no-referrer");
  // Disable the legacy XSS auditor (modern guidance: rely on CSP instead).
  res.set("X-XSS-Protection", "0");
  // Limit who can read this server's resources cross-origin.
  res.set("Cross-Origin-Resource-Policy", "same-origin");
  // Drop access to powerful browser features the app doesn't use.
  res.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");

  // HSTS is only meaningful (and only honoured by browsers) over HTTPS.
  // Gated to production; harmless if the deployment is still on HTTP.
  if (process.env.NODE_ENV === "production") {
    res.set("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }

  return next();
}
