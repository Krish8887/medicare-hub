#!/usr/bin/env node
/**
 * Cross-platform production starter.
 *
 * Replaces: `NODE_ENV=production bun .next/standalone/server.js 2>&1 | tee server.log`
 * (`VAR=value cmd` and `tee` are Unix-only shell syntax). This runs the
 * standalone Next.js server with plain Node — no bun required — and tees
 * output to server.log, on Windows / macOS / Linux alike.
 */
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const server = path.join(".next", "standalone", "server.js");
const port = process.env.PORT || "3000";

if (!fs.existsSync(server)) {
  console.error(`✗ ${server} not found — run \`npm run build\` first.`);
  process.exit(1);
}

const logPath = path.join(process.cwd(), "server.log");
const logStream = fs.createWriteStream(logPath, { flags: "a" });

const child = spawn(process.execPath, [server], {
  stdio: ["inherit", "pipe", "pipe"],
  env: { ...process.env, NODE_ENV: "production", PORT: port },
});

console.log(`> production server on port ${port}  (log file: ${logPath})`);

const tee = (stream) => {
  stream.on("data", (chunk) => {
    process.stdout.write(chunk);
    logStream.write(chunk);
  });
};
tee(child.stdout);
tee(child.stderr);

const shutdown = () => {
  child.kill();
  logStream.end();
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

child.on("exit", (code) => {
  logStream.end();
  process.exit(code ?? 0);
});
