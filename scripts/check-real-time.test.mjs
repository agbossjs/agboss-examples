// agbossjs/agboss#523 AC2 — `check-real-time.mjs` (`npm run check:real-time`, a CI step): no test
// asserts a real-time duration against a fixed threshold, and this repository has none. The planted
// assertions are built from parts, so this file itself holds none.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { findingsOf } from "./check-real-time.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const scratch = mkdtempSync(join(tmpdir(), "examples-check-real-time-"));
const assertion = (argument, matcher, expected) =>
  ["expect(", argument, ").", matcher, "(", expected, ");"].join("");
const found = (...lines) => findingsOf(`${lines.join("\n")}\n`, "a.test.ts");

after(() => rmSync(scratch, { recursive: true, force: true }));

describe("AC2: a real-time threshold assertion is found", () => {
  for (const [name, line, why] of [
    ["a real time read", assertion("Date.now() - started", "toBeLessThan", "2000"), /reads the real time/],
    ["a duration", assertion("call.end - call.start", "toBeGreaterThanOrEqual", "300"), /is a difference/],
  ])
    it(`AC2: ${name}`, () => {
      const findings = found(line);
      assert.equal(findings.length, 1);
      assert.match(findings[0], why);
    });

  it("AC2: a variable assigned a real time read, compared later", () => {
    const findings = found("const tookMs = Date.now() - killedAt;", assertion("tookMs", "toBeLessThan", "70_000"));
    assert.equal(findings.length, 1);
    assert.match(findings[0], /a\.test\.ts:2: .*reads tookMs, a real time read/);
  });
});

describe("AC2: what is not a real-time threshold passes", () => {
  for (const [name, line] of [
    ["the order of two events", assertion("call.start", "toBeGreaterThanOrEqual", "before.end")],
    ["a count", assertion("html.length", "toBeGreaterThan", "1000")],
    ["a time read against 0", assertion("Date.now()", "toBeGreaterThan", "0")],
  ])
    it(`AC2: ${name}`, () => assert.deepEqual(found(line), []));
});

describe("AC2: the command", () => {
  const checkRealTime = (root) =>
    spawnSync(process.execPath, [join(ROOT, "scripts", "check-real-time.mjs"), root], { encoding: "utf8" });

  it("AC2: this repository's tests assert no real-time threshold, exit 0", () => {
    const ran = checkRealTime(ROOT);
    assert.equal(ran.stderr, "");
    assert.equal(ran.status, 0);
  });

  it("AC2: a planted one fails, exit 1, naming the file and line", () => {
    mkdirSync(join(scratch, "tests"), { recursive: true });
    writeFileSync(join(scratch, "tests", "slow.test.ts"), `\n${assertion("Date.now() - s", "toBeLessThan", "2000")}\n`);
    const ran = checkRealTime(scratch);
    assert.equal(ran.status, 1);
    assert.match(ran.stderr, /tests\/slow\.test\.ts:2: expect\(Date\.now\(\) - s\)/);
  });
});
