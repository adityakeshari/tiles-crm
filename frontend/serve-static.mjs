import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createServer, request as httpRequest } from "node:http";

const distDir = join(process.cwd(), "dist");
const host = "127.0.0.1";
const port = 5173;
const apiTargetHost = "127.0.0.1";
const apiTargetPort = 5000;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function sendFile(res, filePath) {
  const ext = extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": contentTypes[ext] || "application/octet-stream",
    "Cache-Control": "no-cache",
  });
  createReadStream(filePath).pipe(res);
}

createServer((req, res) => {
  const rawPath = req.url?.split("?")[0] || "/";

  if (rawPath.startsWith("/api/")) {
    const proxyRequest = httpRequest(
      {
        host: apiTargetHost,
        port: apiTargetPort,
        path: req.url,
        method: req.method,
        headers: {
          ...req.headers,
          host: `${apiTargetHost}:${apiTargetPort}`,
        },
      },
      (proxyResponse) => {
        res.writeHead(proxyResponse.statusCode || 500, proxyResponse.headers);
        proxyResponse.pipe(res);
      }
    );

    proxyRequest.on("error", () => {
      res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ message: "Backend API is not reachable on localhost:5000" }));
    });

    req.pipe(proxyRequest);
    return;
  }

  const requestPath = rawPath === "/" ? "/index.html" : rawPath;
  const safePath = normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(distDir, safePath);

  if (existsSync(filePath) && statSync(filePath).isFile()) {
    sendFile(res, filePath);
    return;
  }

  const fallback = join(distDir, "index.html");
  if (existsSync(fallback)) {
    sendFile(res, fallback);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Frontend build not found. Run npm run build first.");
}).listen(port, host, () => {
  console.log(`Tiles CRM frontend running on http://${host}:${port}`);
});
