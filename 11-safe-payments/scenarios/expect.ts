import type { Expectation, ScenarioOutcome } from "./scenario.types.js";

const COUNTS = ["charges", "captures", "refunds", "voids", "confirms", "amountCharged", "amountRefunded"] as const;

/** What does not match: one line per field (`charges: 2, expected 1`); none when it all does. */
export function mismatchesOf(outcome: ScenarioOutcome, expected: Expectation): string[] {
  const mismatches: string[] = [];
  for (const field of COUNTS) {
    const want = expected[field];
    if (want !== undefined && outcome[field] !== want)
      mismatches.push(`${field}: ${String(outcome[field])}, expected ${String(want)}`);
  }
  if (expected.lost === "some" ? outcome.lost === 0 : expected.lost !== undefined && outcome.lost !== expected.lost)
    mismatches.push(`lost: ${String(outcome.lost)}, expected ${String(expected.lost)}`);
  if (expected.orderStatus !== undefined && outcome.orderStatus !== expected.orderStatus)
    mismatches.push(`order: ${String(outcome.orderStatus)}, expected ${expected.orderStatus}`);
  for (const note of expected.notes ?? [])
    if (!outcome.notes.some((seen) => seen.includes(note))) mismatches.push(`no note "${note}" in ${outcome.notes.join("; ")}`);
  return mismatches;
}

/** Throws, naming every mismatch, unless `outcome` shows what `expected` says. */
export function assertShows(outcome: ScenarioOutcome, expected: Expectation): void {
  const mismatches = mismatchesOf(outcome, expected);
  if (mismatches.length > 0)
    throw new Error(`${outcome.row} (${outcome.variant}) is NOT as expected:\n  ${mismatches.join("\n  ")}`);
}
