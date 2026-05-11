import dotenv from "dotenv";
import app from "./app.js";

dotenv.config();

const port = process.env.PORT || 5000;

const server = app.listen(port, () => {
  console.log(`Tiles CRM backend running on http://localhost:${port}`);
});

server.keepAliveTimeout = Number(process.env.KEEP_ALIVE_TIMEOUT_MS || 5000);
server.headersTimeout = Number(process.env.HEADERS_TIMEOUT_MS || 8000);
server.requestTimeout = Number(process.env.REQUEST_TIMEOUT_MS || 30000);
server.maxRequestsPerSocket = Number(process.env.MAX_REQUESTS_PER_SOCKET || 100);

function shutdown(signal) {
  console.log(`${signal} received, shutting down server`);
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
