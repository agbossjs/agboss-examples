import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { startVitest } from "vitest/node";
import { recordedRows, tableOf, verdictOf } from "./report.js";

/**
 * `npm run demo` — offline, $0: every scenario of Wiki → Payment scenarios (PS1–PS23), the wrong
 * version and the right one, against the stub gateway, through the example's own scenario tests;
 * then one table, scenario × version → what the stub carried out — its own records, never the
 * application's view — written to stdout and `.artifacts/report.json`. Exit 1 when a row is not as
 * expected. The two real-process runs (PS2, PS5 `SIGKILL`ed, about a minute each) run with
 * `--processes`; without it, their last recorded result is printed when there is one.
 */
const root = join(import.meta.dirname, "..");
const rowsDir = join(root, ".artifacts", "rows");
const withProcesses = process.argv.includes("--processes");

// a fresh run: every in-process row again; the process rows kept unless they run now
if (existsSync(rowsDir))
  for (const file of readdirSync(rowsDir))
    if (withProcesses || !file.includes("process")) rmSync(join(rowsDir, file), { force: true });
const files = ["tests/scenarios/"];
if (withProcesses) files.push("tests/processes/");

const vitest = await startVitest("test", files, {
  root,
  watch: false,
  reporters: ["dot"],
  ...(withProcesses ? {} : { exclude: ["tests/processes/**", "node_modules/**"] }),
});
await vitest.close();

if (!existsSync(rowsDir)) {
  process.stderr.write("no scenario recorded a row\n");
  process.exit(1);
}
const rows = recordedRows(rowsDir);
process.stdout.write(`\nSafe payments — every number from the stub gateway's own records\n\n${tableOf(rows)}\n`);
mkdirSync(join(root, ".artifacts"), { recursive: true });
const report = rows.map((row) => ({ ...row.outcome, verdict: verdictOf(row) }));
writeFileSync(join(root, ".artifacts", "report.json"), `${JSON.stringify(report, null, 2)}\n`);
const failed = rows.filter((row) => row.mismatches.length > 0);
process.stdout.write(
  `\n${String(rows.length)} rows, ${String(failed.length)} not as expected — .artifacts/report.json\n` +
    "Independent example: the stub gateway is fictional and imitates no real gateway.\n",
);
process.exit(failed.length > 0 || process.exitCode === 1 ? 1 : 0);
