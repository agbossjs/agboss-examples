/**
 * agbossjs/agboss#487 AC6 — the example carries none of the fencing boilerplate: no table of its own
 * (no `CREATE TABLE`, no fencing-token or idempotency-key table), no lease service of its own, and
 * no query against the core's tables (`execution_leases`, `checkpoints`, `child_execution_queue`, any
 * `agboss_*` table of `@agboss/postgres`). The stores and the fenced effect keep all of it; the
 * verification reads the public API only.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../..", import.meta.url).pathname;

/** Every file under `dir` with one of the extensions. */
function filesIn(dir: string, extensions: readonly string[]): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return filesIn(path, extensions);
    return extensions.some((extension) => name.endsWith(extension)) ? [path] : [];
  });
}

const SOURCES = [
  ...filesIn(join(ROOT, "src"), [".ts", ".sql"]),
  ...filesIn(join(ROOT, "scripts"), [".mjs", ".sh"]),
  ...filesIn(join(ROOT, "deploy"), [".yaml", ".json"]),
];

const FORBIDDEN: readonly [RegExp, string][] = [
  [/\bCREATE\s+TABLE\b/iu, "a table of its own"],
  [/fencing[_-]?tokens?/iu, "a fencing-token table"],
  [/idempotency[_-]?keys\b/iu, "an idempotency-key table"],
  [/LeaseFencingService/u, "a lease service of its own"],
  [/\bexecution_leases\b/u, "the core's lease table"],
  [/\bchild_execution_queue\b/u, "the core's child queue table"],
  [/\bFROM\s+checkpoints\b|\bcheckpoint_blobs\b|\bcheckpoint_writes\b/iu, "the checkpoint tables"],
  // the metrics are agboss_cluster_* / agboss_instance_* (and the adapter's agboss_slot_demand)
  [/\bagboss_(?!cluster_|instance_|slot_demand)[a-z_]+\b/u, "a table of @agboss/postgres"],
  [/\b(SELECT|INSERT|UPDATE|DELETE)\b[^;\n]*\b(FROM|INTO|SET)\b/u, "a query of its own"],
];

describe("AC6: no fencing or idempotency tables, no queries against the core's tables", () => {
  it("scans every source, script and manifest of the example", () => {
    expect(SOURCES.length).toBeGreaterThan(20);
  });

  it.each(FORBIDDEN)("nothing matches %s (%s)", (pattern) => {
    const hits = SOURCES.filter((file) => pattern.test(readFileSync(file, "utf8"))).map((file) => file.slice(ROOT.length));
    expect(hits).toEqual([]);
  });

  it("the scan bites: a hand-rolled fencing table would be found", () => {
    const sample = "CREATE TABLE fencing_tokens (scope_key TEXT PRIMARY KEY, highest INTEGER); SELECT * FROM agboss_execution_leases";
    expect(FORBIDDEN.filter(([pattern]) => pattern.test(sample)).length).toBeGreaterThanOrEqual(4);
  });
});
