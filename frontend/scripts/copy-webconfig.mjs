import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = join(root, "web.config");
const distDir = join(root, "dist");
const target = join(distDir, "web.config");

if (!existsSync(source)) {
  console.error("web.config not found in frontend root.");
  process.exit(1);
}

if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

copyFileSync(source, target);
console.log("Copied web.config to dist/web.config");
