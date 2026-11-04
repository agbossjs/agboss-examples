// agbossjs/agboss#763 AC2 — every example's `npm run check` runs `agboss check --strict --cassettes`
// on every application it has: a warning (an error under `--strict`) or a stale cassette in any
// example fails its check, and so the smoke CI. Each `*.application.ts` of a project is named by the
// project's `agboss.application` or by an `--application` of its check script.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { PROJECTS } from "./run-all.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIPPED = new Set(["node_modules", ".agboss", ".packed", ".artifacts", "dist", "cases"]);

/** The project's application files, relative to it (negative fixtures under `cases/` left out). */
function applicationsOf(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return SKIPPED.has(entry.name) ? [] : applicationsOf(join(dir, entry.name), base);
    return entry.name.endsWith(".application.ts") ? [relative(base, join(dir, entry.name)).split(sep).join("/")] : [];
  });
}

/** Every `agboss check …` of a script, up to its `&&`. */
const agbossChecksOf = (script) =>
  script
    .split("&&")
    .map((part) => part.trim())
    .filter((part) => /^agboss check(\s|$)/.test(part));

describe("#763: every example checks every application strictly, cassettes included", () => {
  for (const project of PROJECTS) {
    it(`${project.name}: npm run check runs agboss check --strict --cassettes on each application`, () => {
      const dir = join(ROOT, project.name);
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      const checks = agbossChecksOf(pkg.scripts.check);
      assert.ok(checks.length > 0, `${project.name}: its check script runs no agboss check`);
      for (const command of checks) {
        assert.match(command, /\s--strict(\s|$)/, `${project.name}: "${command}" without --strict`);
        assert.match(command, /\s--cassettes(\s|$)/, `${project.name}: "${command}" without --cassettes`);
      }
      const checked = new Set(
        checks.map((command) => /--application\s+(\S+)/.exec(command)?.[1] ?? pkg.agboss.application),
      );
      assert.deepEqual([...checked].sort(), applicationsOf(dir).sort(), `${project.name}: the applications its check covers`);
    });
  }
});
