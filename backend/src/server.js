import dotenv from "dotenv";
import app from "./app.js";

dotenv.config();

const port = process.env.PORT || 5000;

const server = app.listen(port, () => {
  console.log(`Tiles CRM backend running on http://localhost:${port}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down server`);
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
