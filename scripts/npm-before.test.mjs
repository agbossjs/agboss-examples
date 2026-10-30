// agbossjs/agboss#523 AC1 — an install that resolves ranges takes no release younger than three
// days: `npm-before.mjs` builds `npm install --before=<now − 3 days>` (`AGBOSS_NPM_BEFORE`
// overrides the date), and every install script of this repository builds its arguments with it
// (`check-installs.mjs` proves the last on the repository: check-installs.test.mjs).
import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "node:test";
import { localBinOf } from "./local-bin.mjs";
import {
  MINIMUM_RELEASE_AGE_DAYS,
  NpmBeforeError,
  npmBeforeOf,
  rangeInstallArguments,
} from "./npm-before.mjs";

const NOW = new Date("2026-10-31T12:00:00.000Z");

describe("AC1: the minimum release age of an install that resolves ranges", () => {
  it("AC1: is three days: --before is now minus three days when nothing overrides it", () => {
    assert.equal(MINIMUM_RELEASE_AGE_DAYS, 3);
    assert.equal(npmBeforeOf({}, NOW), "2026-10-28T12:00:00.000Z");
  });

  it("AC1: an empty AGBOSS_NPM_BEFORE is unset", () => {
    assert.equal(npmBeforeOf({ AGBOSS_NPM_BEFORE: "" }, NOW), "2026-10-28T12:00:00.000Z");
  });

  it("AC1: AGBOSS_NPM_BEFORE overrides the date", () => {
    assert.equal(
      npmBeforeOf({ AGBOSS_NPM_BEFORE: "2026-10-31T11:59:00Z" }, NOW),
      "2026-10-31T11:59:00.000Z",
    );
  });

  it("AC1: an AGBOSS_NPM_BEFORE that is not a date fails, naming the variable", () => {
    assert.throws(() => npmBeforeOf({ AGBOSS_NPM_BEFORE: "soon" }, NOW), NpmBeforeError);
    assert.throws(() => npmBeforeOf({ AGBOSS_NPM_BEFORE: "soon" }, NOW), /AGBOSS_NPM_BEFORE=soon is not a date/);
  });

  it("AC1: the arguments are install, --before, then the rest in order", () => {
    assert.deepEqual(rangeInstallArguments(["--no-audit", "--no-fund"], {}, NOW), [
      "install",
      "--before=2026-10-28T12:00:00.000Z",
      "--no-audit",
      "--no-fund",
    ]);
  });

  it("AC1: the override reaches the install's arguments", () => {
    const args = rangeInstallArguments([], { AGBOSS_NPM_BEFORE: "2026-10-31T12:00:00Z" }, NOW);
    assert.equal(args[1], "--before=2026-10-31T12:00:00.000Z");
  });
});

describe("AC1: a project's own tool runs from its node_modules/.bin, never npx", () => {
  it("AC1: localBinOf names the project's own bin", () => {
    assert.equal(localBinOf("/p/app", "tsc"), join("/p/app", "node_modules", ".bin", "tsc"));
  });
});
