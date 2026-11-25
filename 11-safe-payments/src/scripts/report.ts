import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** What a row's file holds (`scenarios/report-rows.ts` writes it in every scenario test). */
export interface RecordedRow {
  readonly outcome: {
    readonly id: string;
    readonly variant: "wrong" | "right";
    readonly row: string;
    readonly level: string;
    readonly charges: number;
    readonly captures: number;
    readonly refunds: number;
    readonly voids: number;
    readonly confirms: number;
    readonly amountCharged: number;
    readonly amountRefunded: number;
    readonly lost: number;
    readonly orderStatus?: string;
    readonly notes: readonly string[];
  };
  readonly expected: { readonly boundary?: string };
  readonly mismatches: readonly string[];
}

/** Every recorded row, in scenario order (ps1 … ps23), the wrong version before the right one. */
export function recordedRows(dir: string): RecordedRow[] {
  const rows = readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(readFileSync(join(dir, file), "utf8")) as RecordedRow);
  const number = (row: RecordedRow): number => Number(/^ps(\d+)/u.exec(row.outcome.row)?.[1] ?? 0);
  return rows.sort(
    (a, b) =>
      number(a) - number(b) ||
      a.outcome.row.localeCompare(b.outcome.row) ||
      (a.outcome.variant === b.outcome.variant ? 0 : a.outcome.variant === "wrong" ? -1 : 1),
  );
}

/** A row's verdict: as expected, a known boundary (with its ticket), or NOT as expected. */
export function verdictOf(row: RecordedRow): string {
  if (row.mismatches.length > 0) return `NOT as expected: ${row.mismatches.join("; ")}`;
  return row.expected.boundary === undefined ? "as expected" : `as expected — boundary ${row.expected.boundary}`;
}

const money = (cents: number): string => (cents / 100).toFixed(2);

/** The table: scenario × version → what the stub carried out, and the verdict. */
export function tableOf(rows: readonly RecordedRow[]): string {
  const header = ["row", "version", "level", "charges", "captures", "refunds", "voids", "confirms", "lost", "verdict"];
  const lines = rows.map(({ outcome }, index) => {
    const row = rows[index];
    return [
      outcome.row,
      outcome.variant,
      outcome.level,
      `${String(outcome.charges)} (${money(outcome.amountCharged)})`,
      String(outcome.captures),
      `${String(outcome.refunds)} (${money(outcome.amountRefunded)})`,
      String(outcome.voids),
      String(outcome.confirms),
      money(outcome.lost),
      row === undefined ? "" : verdictOf(row),
    ];
  });
  const widths = header.map((title, column) => Math.max(title.length, ...lines.map((line) => line[column]?.length ?? 0)));
  const format = (cells: readonly string[]): string =>
    cells.map((cell, column) => (column === cells.length - 1 ? cell : cell.padEnd(widths[column] ?? 0))).join("  ");
  return [format(header), format(widths.map((width) => "-".repeat(width))), ...lines.map(format)].join("\n");
}
