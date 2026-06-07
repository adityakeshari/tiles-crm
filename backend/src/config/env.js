import dotenv from "dotenv";

dotenv.config();

// Fail fast on startup if required secrets are missing — never fall back to a
// hardcoded default for anything security-sensitive (e.g. JWT signing).
const requiredEnvVars = ["JWT_SECRET"];

const missing = requiredEnvVars.filter((key) => {
  const value = process.env[key];
  return typeof value !== "string" || value.trim().length === 0;
});

if (missing.length > 0) {
  console.error(
    `[tiles-crm] Missing required environment variable(s): ${missing.join(", ")}.\n` +
      "[tiles-crm] Set them in backend/.env before starting the server " +
      "(see backend/.env.example for the required keys and format)."
  );
  process.exit(1);
}
