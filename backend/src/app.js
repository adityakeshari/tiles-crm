import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import billingRoutes from "./routes/billing.js";
import complaintsRoutes from "./routes/complaints.js";
import dashboardRoutes from "./routes/dashboard.js";
import dailyTasksRoutes, { externalDailyTasksRouter } from "./routes/daily-tasks.js";
import dealersRoutes from "./routes/dealers.js";
import expensesRoutes from "./routes/expenses.js";
import exportsRoutes from "./routes/exports.js";
import inventoryRoutes from "./routes/inventory.js";
import leadsRoutes from "./routes/leads.js";
import notificationsRoutes from "./routes/notifications.js";
import ownerSummaryRoutes from "./routes/owner-summary.js";
import plumbingRoutes from "./routes/plumbing.js";
import purchaseCostingRoutes from "./routes/purchase-costing.js";
import projectsRoutes from "./routes/projects.js";
import purchasesRoutes from "./routes/purchases.js";
import reportsRoutes from "./routes/reports.js";
import schemesRoutes from "./routes/schemes.js";
import suppliersRoutes from "./routes/suppliers.js";
import usersRoutes from "./routes/users.js";
import { requireAuth } from "./middleware/auth.js";
import { securityHeaders } from "./middleware/security-headers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, "..", "..", "frontend", "dist");
const indexHtmlPath = path.join(clientDistPath, "index.html");
const hasFrontendBuild = fs.existsSync(indexHtmlPath);

if (!hasFrontendBuild) {
  console.warn(`[tiles-crm] Frontend build not found at ${indexHtmlPath}. Browser routes will return a clear 404 until frontend is built.`);
}

const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set("trust proxy", 1);

app.use(securityHeaders);

// Redact sensitive query params (e.g. ?token=) so JWTs / API keys never land
// in request logs, browser history copies, or proxy logs.
function sanitizeUrlForLog(originalUrl) {
  return String(originalUrl).replace(
    /([?&](?:token|access_token|api_key|x-internal-api-key|x-task-api-key)=)[^&#]*/gi,
    "$1[REDACTED]"
  );
}

app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    console.log(`[${new Date().toISOString()}] ${req.method} ${sanitizeUrlForLog(req.originalUrl)} -> ${res.statusCode} (${durationMs}ms)`);
  });

  next();
});

// CORS decision is made per-request so that same-origin requests (the SPA is
// served from this same server) always work, even when ALLOWED_ORIGINS is not
// configured. Cross-origin requests are allowed only if explicitly listed; in
// production an unconfigured allow-list fails closed for *other* origins. A
// disallowed origin gets `origin:false` (CORS headers simply omitted) rather
// than an error, so the request still completes and the browser enforces the block.
function corsOptionsDelegate(req, callback) {
  const requestOrigin = req.headers.origin;

  if (!requestOrigin) {
    // No Origin header => same-origin, server-to-server, or curl.
    return callback(null, { origin: true });
  }

  const selfOrigin = `${req.protocol}://${req.get("host")}`;
  if (requestOrigin === selfOrigin || allowedOrigins.includes(requestOrigin)) {
    return callback(null, { origin: true });
  }

  if (allowedOrigins.length === 0 && process.env.NODE_ENV !== "production") {
    // Dev convenience only: allow any origin when nothing is configured.
    return callback(null, { origin: true });
  }

  // Cross-origin and not allowed: omit CORS headers (browser blocks reads).
  return callback(null, { origin: false });
}

app.use(cors(corsOptionsDelegate));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/billing", requireAuth, billingRoutes);
app.use("/api/complaints", requireAuth, complaintsRoutes);
app.use("/api/dashboard", requireAuth, dashboardRoutes);
app.use("/api/daily-tasks", externalDailyTasksRouter);
app.use("/api/daily-tasks", requireAuth, dailyTasksRoutes);
app.use("/api/owner-summary", ownerSummaryRoutes);
app.use("/api/leads", requireAuth, leadsRoutes);
app.use("/api/dealers", requireAuth, dealersRoutes);
app.use("/api/expenses", requireAuth, expensesRoutes);
app.use("/api/exports", requireAuth, exportsRoutes);
app.use("/api/inventory", requireAuth, inventoryRoutes);
app.use("/api/notifications", requireAuth, notificationsRoutes);
app.use("/api/plumbing", requireAuth, plumbingRoutes);
app.use("/api/purchase-costing", requireAuth, purchaseCostingRoutes);
app.use("/api/projects", requireAuth, projectsRoutes);
app.use("/api/purchases", requireAuth, purchasesRoutes);
app.use("/api/reports", requireAuth, reportsRoutes);
app.use("/api/schemes", requireAuth, schemesRoutes);
app.use("/api/suppliers", requireAuth, suppliersRoutes);
app.use("/api/users", requireAuth, usersRoutes);

// JSON 404 for unmatched API routes. Must come before the SPA fallback so missing
// endpoints don't return index.html with a 200 status.
app.use("/api", (_req, res) => {
  res.status(404).json({ message: "API route not found" });
});

if (hasFrontendBuild) {
  app.use(express.static(clientDistPath));
}

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }

  if (!hasFrontendBuild) {
    return res.status(404).json({
      message: "Frontend build not found. Run npm run build before serving browser routes.",
    });
  }

  return res.sendFile(indexHtmlPath);
});

app.use((error, _req, res, _next) => {
  if (res.headersSent) {
    return;
  }

  res.status(500).json({
    message: "Unexpected server error",
    error: process.env.NODE_ENV === "production" ? undefined : error.message,
  });
});

export default app;
