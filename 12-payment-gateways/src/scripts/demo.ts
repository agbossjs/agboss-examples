import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { startVitest } from "vitest/node";

/**
 * `npm run demo` — offline, $0: each supported gateway's official SDK through its scenarios
 * against its local stub (the gateway tests of this project), then one table, gateway × scenario →
 * charges, captures and refunds from the stubs' own records; `.artifacts/report.json`. Exit 1 when
 * a row is not as expected. Independent example: no gateway is called, none is affiliated.
 */
const root = join(import.meta.dirname, "..");
const rowsDir = join(root, ".artifacts", "rows");
rmSync(rowsDir, { recursive: true, force: true });

const vitest = await startVitest("test", ["tests/gateways/"], { root, watch: false, reporters: ["dot"], exclude: ["tests/gateways/stubs.test.ts", "node_modules/**"] });
await vitest.close();

interface Row {
  readonly outcome: { gateway: string; row: string; charges: number; captures: number; refunds: number; notes: readonly string[] };
  readonly expected: { boundary?: string };
  readonly mismatches: readonly string[];
}
if (!existsSync(rowsDir)) {
  process.stderr.write("no gateway recorded a row\n");
  process.exit(1);
}
const rows = readdirSync(rowsDir)
  .map((file) => JSON.parse(readFileSync(join(rowsDir, file), "utf8")) as Row)
  .sort((a, b) => a.outcome.row.localeCompare(b.outcome.row, "en", { numeric: true }));
const verdict = (row: Row): string =>
  row.mismatches.length > 0 ? `NOT as expected: ${row.mismatches.join("; ")}` : row.expected.boundary === undefined ? "as expected" : `as expected — boundary ${row.expected.boundary}`;
const lines = rows.map(({ outcome }, index) => [outcome.gateway, outcome.row.split(" ")[1] ?? "", String(outcome.charges), String(outcome.captures), String(outcome.refunds), verdict(rows[index] as Row)]);
const header = ["gateway", "scenario", "charges", "captures", "refunds", "verdict"];
const widths = header.map((title, column) => Math.max(title.length, ...lines.map((line) => line[column]?.length ?? 0)));
const format = (cells: readonly string[]) => cells.map((cell, column) => (column === cells.length - 1 ? cell : cell.padEnd(widths[column] ?? 0))).join("  ");
process.stdout.write(`\nPayment gateways — every number from the stubs' own records\n\n${[format(header), format(widths.map((w) => "-".repeat(w))), ...lines.map(format)].join("\n")}\n`);
mkdirSync(join(root, ".artifacts"), { recursive: true });
writeFileSync(join(root, ".artifacts", "report.json"), `${JSON.stringify(rows.map((row) => ({ ...row.outcome, verdict: verdict(row) })), null, 2)}\n`);
const failed = rows.filter((row) => row.mismatches.length > 0).length;
process.stdout.write(`\n${String(rows.length)} rows, ${String(failed)} not as expected. Independent example, not affiliated with any gateway.\n`);
process.exit(failed > 0 || rows.length === 0 ? 1 : 0);
