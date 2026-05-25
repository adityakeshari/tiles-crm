export function requireInternalApiKey(req, res, next) {
  const configuredKey = process.env.CRM_OWNER_SUMMARY_API_KEY;

  if (!configuredKey) {
    return res.status(503).json({
      success: false,
      generatedAt: new Date().toISOString(),
      timezone: "Asia/Kolkata",
      error: {
        code: "INTERNAL_AUTH_NOT_CONFIGURED",
        message: "CRM owner summary internal API key is not configured",
      },
    });
  }

  const providedKey = req.headers["x-internal-api-key"];

  if (typeof providedKey !== "string" || providedKey !== configuredKey) {
    return res.status(401).json({
      success: false,
      generatedAt: new Date().toISOString(),
      timezone: "Asia/Kolkata",
      error: {
        code: "INTERNAL_AUTH_FAILED",
        message: "Invalid internal API key",
      },
    });
  }

  next();
}
