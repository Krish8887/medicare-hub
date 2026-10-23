#!/usr/bin/env node
/**
 * Cross-platform dev runner (Windows / macOS / Linux).
 *
 * Replaces: `next dev -p 3000 2>&1 | tee dev.log`
 * Why: `tee` (and shell piping) is Unix-only — npm runs scripts through
 * cmd.exe on Windows, where it does not exist. This Node script spawns the
 * Next.js dev server directly (via process.execPath, so no .cmd shims are
 * involved) and "tees" output to both the console and dev.log everywhere.
 *
 * Usage:
 *   npm run dev            → next dev -p 3000 (or $PORT if set)
 *   NEXT_ARGS="--turbopack" npm run dev   → custom args before the port
 */
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const port = process.env.PORT || "3000";
const extraArgs = process.env.NEXT_ARGS ? process.env.NEXT_ARGS.split(" ").filter(Boolean) : ["dev"];

const nextBin = path.join("node_modules", "next", "dist", "bin", "next");
const logPath = path.join(process.cwd(), "dev.log");
const logStream = fs.createWriteStream(logPath, { flags: "a" });

const child = spawn(process.execPath, [nextBin, ...extraArgs, "-p", port], {
  stdio: ["inherit", "pipe", "pipe"],
  env: process.env,
});

console.log(`> next dev -p ${port}  (log file: ${logPath})`);

// tee: forward everything to console AND the log file
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
