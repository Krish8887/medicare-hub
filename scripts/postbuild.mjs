#!/usr/bin/env node
/**
 * Cross-platform post-build step.
 *
 * Replaces: `cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/`
 * (`cp` is Unix-only; Windows cmd.exe has no `cp`). Uses Node's fs.cpSync,
 * available since Node 16.7 — works identically on Windows / macOS / Linux.
 */
import fs from "fs";
import path from "path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

if (!fs.existsSync(standalone)) {
  console.error(`✗ ${path.join(".next", "standalone")} not found — build with \`npm run build\` first.`);
  process.exit(1);
}

const staticSrc = path.join(root, ".next", "static");
const staticDest = path.join(standalone, ".next", "static");
if (fs.existsSync(staticSrc)) {
  fs.cpSync(staticSrc, staticDest, { recursive: true });
  console.log("✓ Copied .next/static → .next/standalone/.next/static");
} else {
  console.warn("! .next/static missing — skipping static assets copy");
}

const publicSrc = path.join(root, "public");
const publicDest = path.join(standalone, "public");
if (fs.existsSync(publicSrc)) {
  fs.cpSync(publicSrc, publicDest, { recursive: true });
  console.log("✓ Copied public → .next/standalone/public");
}

console.log("Standalone build is ready: node .next/standalone/server.js");
