import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Expectation, ScenarioOutcome } from "./scenario.types.js";

/** Where each test file writes the rows it ran: `npm run demo` reads them into one table. */
export const ROWS_DIR = join(import.meta.dirname, "..", ".artifacts", "rows");

/** One row of the report: an outcome as the stub recorded it, what was expected, the verdict. */
export interface ReportRow {
  readonly outcome: ScenarioOutcome;
  readonly expected: Expectation;
  /** Empty: as expected. */
  readonly mismatches: readonly string[];
}

/** Writes one row (`.artifacts/rows/<row>.<variant>.json`), the outcome read from the stub's records. */
export function recordRow(row: ReportRow): void {
  mkdirSync(ROWS_DIR, { recursive: true });
  const file = `${row.outcome.row.replaceAll(/[^\w-]+/gu, "_")}.${row.outcome.variant}.json`;
  writeFileSync(join(ROWS_DIR, file), `${JSON.stringify(row, null, 2)}\n`);
}
