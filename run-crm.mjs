import { spawn } from "node:child_process";
import process from "node:process";

const root = "C:\\Users\\hp\\Documents\\tiles-crm";
const nodeBin = "C:\\Program Files\\nodejs\\node.exe";

function start(name, cwd, args) {
  const child = spawn(nodeBin, args, {
    cwd,
    stdio: "inherit",
    windowsHide: false,
  });

  child.on("exit", (code, signal) => {
    console.log(`[${name}] exited`, { code, signal });
  });

  child.on("error", (error) => {
    console.error(`[${name}] failed to start:`, error);
  });

  return child;
}

const backend = start("backend", `${root}\\backend`, ["src/server.js"]);
const frontend = start("frontend", `${root}\\frontend`, ["serve-static.mjs"]);

setTimeout(() => {
  spawn("cmd.exe", ["/c", "start", "", "http://127.0.0.1:5173"], {
    cwd: root,
    stdio: "ignore",
    windowsHide: true,
    detached: true,
  }).unref();
}, 2500);

function shutdown() {
  for (const child of [backend, frontend]) {
    if (!child.killed) {
      child.kill();
    }
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("Tiles CRM launcher started.");
console.log("Backend should run on http://localhost:5000");
console.log("Frontend should run on http://127.0.0.1:5173");
console.log("Browser will open automatically in a moment.");
console.log("Keep this window open while using the CRM.");
