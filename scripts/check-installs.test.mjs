// agbossjs/agboss#523 AC1 — `check-installs.mjs` (`npm run check:installs`, a CI step): no workflow
// installs by resolving ranges or runs an unpinned `npx`, no script passes `install` to npm but
// through `rangeInstallArguments()`; and this repository has none of either.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { scriptProblems, workflowProblems } from "./check-installs.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const scratch = mkdtempSync(join(tmpdir(), "examples-check-installs-"));
const step = (command) => `      - run: ${command}\n`;
const inWorkflow = (command) => workflowProblems(step(command), "ci.yml");
const resolving = (sub) =>
  `ci.yml:1: npm ${sub} resolves ranges: use npm ci (or --before, the minimum release age)`;

after(() => rmSync(scratch, { recursive: true, force: true }));

describe("AC1: a workflow installs from its lockfile", () => {
  for (const command of ["npm ci", "npm --prefix .agboss-source ci", "npm run install:packed", 'cache: "npm"'])
    it(`AC1: ${command} passes`, () => assert.deepEqual(inWorkflow(command), []));

  for (const [command, sub] of [
    ["npm install", "install"],
    ["npm i", "i"],
    ["npm --prefix .agboss-source install", "install"],
    ["npm add zod", "add"],
  ])
    it(`AC1: ${command} fails`, () => assert.deepEqual(inWorkflow(command), [resolving(sub)]));

  it("AC1: an install with a minimum release age passes", () => {
    assert.deepEqual(inWorkflow("npm install --before=2026-10-28T00:00:00Z"), []);
  });
});

describe("AC1: a workflow's npx runs a package pinned to an exact version", () => {
  it("AC1: npx tsx@4.20.3 passes", () => assert.deepEqual(inWorkflow("npx tsx@4.20.3 a.ts"), []));

  for (const [command, spec] of [
    ["npx tsx a.ts", "tsx"],
    ["npx --yes tsx@latest", "tsx@latest"],
    ["npm exec --package=a@1 -- a", "a@1"],
  ])
    it(`AC1: ${command} fails`, () =>
      assert.deepEqual(inWorkflow(command), [
        `ci.yml:1: ${spec} is not pinned to an exact version (name@x.y.z)`,
      ]));
});

describe("AC1: a script's install arguments come from the minimum release age", () => {
  it("AC1: rangeInstallArguments() passes; npm's own install argument and npx fail", () => {
    assert.deepEqual(scriptProblems('run("npm", rangeInstallArguments([]));\n', "s.mjs"), []);
    assert.deepEqual(scriptProblems('run("npm", ["install"]);\nrun("npx", ["tsc"]);\n', "s.mjs"), [
      "s.mjs:1: an npm install's arguments come from rangeInstallArguments()",
      "s.mjs:2: run a local tool from node_modules/.bin, not npx",
    ]);
  });
});

describe("AC1: the command", () => {
  const checkInstalls = (root) =>
    spawnSync(process.execPath, [join(ROOT, "scripts", "check-installs.mjs"), root], { encoding: "utf8" });

  it("AC1: this repository's workflows and scripts pass, exit 0", () => {
    const ran = checkInstalls(ROOT);
    assert.equal(ran.stderr, "");
    assert.equal(ran.status, 0);
  });

  it("AC1: a planted unpinned install fails, exit 1", () => {
    mkdirSync(join(scratch, ".github", "workflows"), { recursive: true });
    mkdirSync(join(scratch, "scripts"), { recursive: true });
    writeFileSync(join(scratch, ".github", "workflows", "ci.yml"), step("npm install"));
    writeFileSync(join(scratch, "scripts", "x.mjs"), 'spawn("npm", ["install"]);\n');
    const ran = checkInstalls(scratch);
    assert.equal(ran.status, 1);
    assert.match(ran.stderr, /\.github\/workflows\/ci\.yml:1: npm install resolves ranges/);
    assert.match(ran.stderr, /scripts\/x\.mjs:1: an npm install's arguments/);
  });
});

describe("AC1 acceptance: the forms a guard must not miss (agbossjs/agboss#531)", () => {
  for (const [command, sub] of [
    ["npm install-test", "install-test"],
    ["npm it", "it"],
    ["npm install --beforehand", "install"],
  ])
    it(`AC1: ${command} fails`, () => assert.deepEqual(inWorkflow(command), [resolving(sub)]));

  it("AC1: an install continued on the next line with \\ fails, naming its first line", () => {
    const text = `${step("|")}        npm \\\n          install left-pad\n`;

    assert.deepEqual(workflowProblems(text, "ci.yml"), [
      "ci.yml:2: npm install resolves ranges: use npm ci (or --before, the minimum release age)",
    ]);
  });

  it("AC1: --before given before the subcommand passes; every --package= of an npx is checked", () => {
    assert.deepEqual(inWorkflow("npm --before=2026-10-28T00:00:00Z install"), []);
    assert.deepEqual(inWorkflow("npx --package=tsx@4.20.3 --package=evil tsx"), [
      "ci.yml:1: evil is not pinned to an exact version (name@x.y.z)",
    ]);
  });

  for (const [line, why] of [
    ['execSync("npm install left-pad");', "an npm install's arguments"],
    ['spawnSync("npm", ["i", "left-pad"]);', "an npm install's arguments"],
    ['spawnSync("npm", ["add", "zod"]);', "an npm install's arguments"],
    ["execSync(`npx vitest run`);", "not npx"],
  ])
    it(`AC1: a script's ${line} fails`, () => {
      const [problem] = scriptProblems(`${line}\n`, "s.mjs");

      assert.match(problem, /^s\.mjs:1: /);
      assert.ok(problem.includes(why), problem);
    });

  it("AC1: a comment naming npx or npm install runs nothing; npm ci and npm run pass", () => {
    const text = [
      "// run `npx agboss check` or `npm install` by hand",
      " * `npx tsx` in a doc comment",
      'spawnSync("npm", ["ci", "--no-audit"]);',
      'spawnSync("npm", ["run", "install:packed"]);',
    ].join("\n");

    assert.deepEqual(scriptProblems(text, "s.mjs"), []);
  });
});
