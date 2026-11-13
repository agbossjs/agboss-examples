#!/usr/bin/env node
// A stand-in vendor CLI: `node fake-cli.js <replay,files> <mode> <log> [the CLI's own arguments...]`.
// It records what it was called with, then replays recorded JSONL (or hangs / fails / is slow).
/* global process, console, setTimeout */
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, readdirSync } from "node:fs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const [replay, mode, log, ...args] = process.argv.slice(2);
if (args[0] === "features" && mode === "unknown-features") {
  console.log("{\"features\": [\"alpha\", \"beta\"]}");
  process.exit(0);
}
if (args[0] === "features" && mode === "hang-features-child") {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
  appendFileSync(`${log}.features`, `${process.pid}\n${child.pid}\n`);
  await sleep(600_000);
}
if (args[0] === "features" && mode === "hang-features") await sleep(600_000);
if (args[0] === "features" && mode === "broken-features") process.exit(3);
if (args[0] === "features") {
  console.log("shell_tool  stable  true\nunified_exec  stable  true\nsome_new_feature  stable  true");
  process.exit(0);
}
let stdin = "";
for await (const chunk of process.stdin) stdin += chunk;
const calls = existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean).length : 0;
const schemaAt = args.indexOf("--output-schema");
const schema = schemaAt >= 0 ? readFileSync(args[schemaAt + 1], "utf8") : undefined;
const record = (extra) => appendFileSync(log, `${JSON.stringify({ args, stdin, schema, cwd: process.cwd(), env: Object.keys(process.env), files: readdirSync("."), ...extra })}\n`);

if (mode === "hang") {
  // a grandchild in the same process group: killing only this process would leave it running
  const grandchild = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
  record({ pid: process.pid, grandchild: grandchild.pid });
  await sleep(600_000);
}
if (mode === "fail") {
  record({});
  console.error("429 Too Many Requests: usage limit reached");
  process.exit(1);
}
record({ startedAt: Date.now() });
const order = (word) => process.env.ORDER_LOG && appendFileSync(process.env.ORDER_LOG, `${word}\n`);
order("start");
if (mode === "slow") await sleep(400);
order("end");
const files = replay.split(",");
process.stdout.write(readFileSync(files[Math.min(calls, files.length - 1)], "utf8"));
