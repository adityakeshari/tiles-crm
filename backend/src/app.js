import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import complaintsRoutes from "./routes/complaints.js";
import dealersRoutes from "./routes/dealers.js";
import expensesRoutes from "./routes/expenses.js";
import exportsRoutes from "./routes/exports.js";
import inventoryRoutes from "./routes/inventory.js";
import leadsRoutes from "./routes/leads.js";
import notificationsRoutes from "./routes/notifications.js";
import plumbingRoutes from "./routes/plumbing.js";
import projectsRoutes from "./routes/projects.js";
import schemesRoutes from "./routes/schemes.js";
import usersRoutes from "./routes/users.js";
import { requireAuth } from "./middleware/auth.js";

const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set("trust proxy", 1);

app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`);
  });

  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/complaints", requireAuth, complaintsRoutes);
app.use("/api/leads", requireAuth, leadsRoutes);
app.use("/api/dealers", requireAuth, dealersRoutes);
app.use("/api/expenses", requireAuth, expensesRoutes);
app.use("/api/exports", requireAuth, exportsRoutes);
app.use("/api/inventory", requireAuth, inventoryRoutes);
app.use("/api/notifications", requireAuth, notificationsRoutes);
app.use("/api/plumbing", requireAuth, plumbingRoutes);
app.use("/api/projects", requireAuth, projectsRoutes);
app.use("/api/schemes", requireAuth, schemesRoutes);
app.use("/api/users", requireAuth, usersRoutes);

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
