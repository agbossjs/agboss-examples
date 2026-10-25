import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateProofReport, validatePackageVerification } from "./collect-results.mjs";
import {
  PROJECTS,
  initializeOrLoadRunState,
  parseRunAllArgs,
  selectProjects,
} from "./run-all.mjs";

const FIXTURE_COMMIT = "f22c33254a6eeeb30cf0bbcb72097010eb09f2d5";
const FIXTURE_EXAMPLES_COMMIT = "c187739a00000000000000000000000000000001";
const FIXTURE_AGBOSS_INTEGRITY = "sha512-agbossIntegrityFixture==";
const FIXTURE_AGBOSS_SHA256 = "aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff66667777888899990000";
const FIXTURE_CLI_INTEGRITY = "sha512-agbossCliIntegrityFixture==";
const FIXTURE_CLI_SHA256 = "1111aaaa2222bbbb3333cccc4444dddd5555eeee6666ffff7777888899990000";

function makeManifest(overrides = {}) {
  return {
    sourceCommit: FIXTURE_COMMIT,
    examplesSourceCommit: FIXTURE_EXAMPLES_COMMIT,
    packages: {
      agboss: {
        name: "agboss",
        version: "0.1.0",
        integrity: FIXTURE_AGBOSS_INTEGRITY,
        sha256: FIXTURE_AGBOSS_SHA256,
      },
      agbossCli: {
        name: "agboss-cli",
        version: "0.1.0",
        integrity: FIXTURE_CLI_INTEGRITY,
        sha256: FIXTURE_CLI_SHA256,
      },
    },
    ...overrides,
  };
}

function makePkgVerify(overrides = {}) {
  return {
    status: "PASSED",
    sourceCommit: FIXTURE_COMMIT,
    examplesSourceCommit: FIXTURE_EXAMPLES_COMMIT,
    packages: {
      agboss: {
        integrity: FIXTURE_AGBOSS_INTEGRITY,
        sha256: FIXTURE_AGBOSS_SHA256,
      },
      agbossCli: {
        integrity: FIXTURE_CLI_INTEGRITY,
        sha256: FIXTURE_CLI_SHA256,
      },
    },
    checks: {
      tarballInventories: "passed",
      isolatedConsumerInstall: "passed",
      subpathExportsVerified: [
        "agboss",
        "agboss/dto",
        "agboss/units",
        "agboss/models",
        "agboss/testing",
        "agboss/testing/setup",
        "agboss/eval",
        "agboss/mcp",
        "agboss/rag",
        "agboss/a2a",
        "agboss/eslint",
      ],
      cliBinDelegation: "passed",
      cleanScaffoldCreate: "passed",
      syncedAiSkillsCount: 13,
      scaffoldCheck: "passed",
      scaffoldTypecheck: "passed",
      scaffoldUnitTests: "passed",
      scaffoldDescribe: "passed",
    },
    ...overrides,
  };
}

function makeLastRun({ p0Status = "PASSED", p1Status = "PASSED", overrides = {} } = {}) {
  const projects = {};
  for (const meta of PROJECTS) {
    const status = meta.priority === "P0" ? p0Status : p1Status;
    projects[meta.name] = {
      project: meta.name,
      priority: meta.priority,
      primaryProof: meta.primaryProof,
      mode: meta.mode,
      checkStatus: status,
      checkExitCode: status === "PASSED" ? 0 : null,
      testStatus: status,
      testExitCode: status === "PASSED" ? 0 : null,
      demoStatus: status,
      demoExitCode: status === "PASSED" ? 0 : null,
      durationMs: 120,
    };
  }
  return {
    runId: "run-fixture-1",
    frameworkSourceCommit: FIXTURE_COMMIT,
    examplesSourceCommit: FIXTURE_EXAMPLES_COMMIT,
    packageHashes: {
      agboss: FIXTURE_AGBOSS_INTEGRITY,
      agbossSha256: FIXTURE_AGBOSS_SHA256,
      agbossCli: FIXTURE_CLI_INTEGRITY,
      agbossCliSha256: FIXTURE_CLI_SHA256,
    },
    projects,
    ...overrides,
  };
}

describe("run-all.mjs P0/P1 & --project selection contract (Section 4.3)", () => {
  it("selects only P0 projects by default when --include-p1 is omitted", () => {
    const selected = selectProjects(["--mode", "check"]);
    assert.deepEqual(
      selected.map((p) => p.name),
      [
        "01-hello-agboss",
        "02-path-scope-proof",
        "03-support-refund-desk",
        "04-travel-booking-saga",
        "07-langgraph-migration",
      ],
    );
    assert.equal(
      selected.every((p) => p.priority === "P0"),
      true,
    );
  });

  it("selects both P0 and P1 projects when --include-p1 is passed", () => {
    const selected = selectProjects(["--include-p1", "--mode", "test"]);
    assert.equal(selected.length, 7);
    assert.deepEqual(
      selected.map((p) => p.name),
      PROJECTS.map((p) => p.name),
    );
  });

  it("selects a single specified project via --project even when it is P1", () => {
    const selectedP1 = selectProjects(["--project", "05-cluster-work-stealing", "--mode", "demo"]);
    assert.deepEqual(
      selectedP1.map((p) => p.name),
      ["05-cluster-work-stealing"],
    );

    const selectedP0 = selectProjects(["--project", "02-path-scope-proof"]);
    assert.deepEqual(
      selectedP0.map((p) => p.name),
      ["02-path-scope-proof"],
    );
  });

  it("parses mode, includeP1, projectFilter, and resetState flags accurately", () => {
    assert.deepEqual(parseRunAllArgs([]), {
      mode: "test",
      includeP1: false,
      projectFilter: undefined,
      resetState: false,
    });
    assert.deepEqual(
      parseRunAllArgs([
        "--mode",
        "demo",
        "--include-p1",
        "--project",
        "06-enterprise-agent-mesh",
        "--reset",
      ]),
      {
        mode: "demo",
        includeP1: true,
        projectFilter: "06-enterprise-agent-mesh",
        resetState: true,
      },
    );
  });
});

describe("collect-results.mjs fail-closed release proof gates (P0-1: 10 required scenarios)", () => {
  it("1. All required P0 checks pass -> P0 PASSED", () => {
    const report = evaluateProofReport({
      lastRun: makeLastRun({ p0Status: "PASSED", p1Status: "PASSED" }),
      manifest: makeManifest(),
      pkgVerify: makePkgVerify(),
      currentExamplesCommit: FIXTURE_EXAMPLES_COMMIT,
      requireP1: true,
    });
    assert.equal(report.gates.p0Gate, "PASSED");
    assert.equal(report.gates.p1Gate, "PASSED");
    assert.equal(report.gates.packageGate, "PASSED");
    assert.equal(report.gates.overallGate, "PASSED");
    assert.equal(report.allP0Passed, true);
    assert.equal(report.allP1Passed, true);
  });

  it("2. One P0 demo skipped -> P0 FAILED", () => {
    const lastRun = makeLastRun({ p0Status: "PASSED", p1Status: "PASSED" });
    lastRun.projects["03-support-refund-desk"].demoStatus = "SKIPPED";
    const report = evaluateProofReport({
      lastRun,
      manifest: makeManifest(),
      pkgVerify: makePkgVerify(),
      currentExamplesCommit: FIXTURE_EXAMPLES_COMMIT,
    });
    assert.equal(report.gates.p0Gate, "FAILED");
    assert.equal(report.gates.overallGate, "FAILED");
    assert.equal(report.allP0Passed, false);
  });

  it("3. One P0 test failed -> P0 FAILED", () => {
    const lastRun = makeLastRun({ p0Status: "PASSED", p1Status: "PASSED" });
    lastRun.projects["04-travel-booking-saga"].testStatus = "FAILED";
    const report = evaluateProofReport({
      lastRun,
      manifest: makeManifest(),
      pkgVerify: makePkgVerify(),
      currentExamplesCommit: FIXTURE_EXAMPLES_COMMIT,
    });
    assert.equal(report.gates.p0Gate, "FAILED");
    assert.equal(report.gates.overallGate, "FAILED");
    assert.equal(report.allP0Passed, false);
  });

  it("4. P1 projects skipped / not run -> P1 is NOT_RUN (or FAILED when --require-p1), never PASSED", () => {
    const lastRun = makeLastRun({ p0Status: "PASSED", p1Status: "NOT_RUN" });
    const reportOptionalP1 = evaluateProofReport({
      lastRun,
      manifest: makeManifest(),
      pkgVerify: makePkgVerify(),
      currentExamplesCommit: FIXTURE_EXAMPLES_COMMIT,
      requireP1: false,
    });
    assert.equal(reportOptionalP1.gates.p1Gate, "NOT_RUN");
    assert.equal(reportOptionalP1.allP1Passed, false);

    // Also if only ONE P1 project is skipped while the other passed, P1 gate must be FAILED (never PASSED)
    const partialP1Run = makeLastRun({ p0Status: "PASSED", p1Status: "PASSED" });
    partialP1Run.projects["06-enterprise-agent-mesh"].checkStatus = "SKIPPED";
    partialP1Run.projects["06-enterprise-agent-mesh"].testStatus = "SKIPPED";
    partialP1Run.projects["06-enterprise-agent-mesh"].demoStatus = "SKIPPED";
    const reportPartialP1 = evaluateProofReport({
      lastRun: partialP1Run,
      manifest: makeManifest(),
      pkgVerify: makePkgVerify(),
      currentExamplesCommit: FIXTURE_EXAMPLES_COMMIT,
      requireP1: false,
    });
    assert.equal(reportPartialP1.gates.p1Gate, "FAILED");
    assert.equal(reportPartialP1.allP1Passed, false);

    // And when --require-p1 is passed, unexecuted P1 is FAILED
    const reportRequiredP1 = evaluateProofReport({
      lastRun,
      manifest: makeManifest(),
      pkgVerify: makePkgVerify(),
      currentExamplesCommit: FIXTURE_EXAMPLES_COMMIT,
      requireP1: true,
    });
    assert.equal(reportRequiredP1.gates.p1Gate, "FAILED");
    assert.equal(reportRequiredP1.gates.overallGate, "FAILED");
  });

  it("5. A required project is missing on disk or in last-run -> FAILED", () => {
    const reportMissingOnDisk = evaluateProofReport({
      lastRun: makeLastRun({ p0Status: "PASSED", p1Status: "PASSED" }),
      manifest: makeManifest(),
      pkgVerify: makePkgVerify(),
      currentExamplesCommit: FIXTURE_EXAMPLES_COMMIT,
      projectExistsFn: (name) => name !== "02-path-scope-proof",
    });
    assert.equal(reportMissingOnDisk.gates.p0Gate, "FAILED");
    assert.equal(reportMissingOnDisk.gates.overallGate, "FAILED");

    const lastRunMissingEntry = makeLastRun({ p0Status: "PASSED", p1Status: "PASSED" });
    delete lastRunMissingEntry.projects["01-hello-agboss"];
    const reportMissingEntry = evaluateProofReport({
      lastRun: lastRunMissingEntry,
      manifest: makeManifest(),
      pkgVerify: makePkgVerify(),
      currentExamplesCommit: FIXTURE_EXAMPLES_COMMIT,
    });
    assert.equal(reportMissingEntry.gates.p0Gate, "FAILED");
    assert.equal(reportMissingEntry.gates.overallGate, "FAILED");
  });

  it("6. Package verification JSON is missing -> NOT_RUN / BLOCKED and overall gate FAILED", () => {
    const vMissingPkgVerify = validatePackageVerification(undefined, makeManifest());
    assert.equal(vMissingPkgVerify.status, "NOT_RUN");
    assert.equal(vMissingPkgVerify.valid, false);

    const vMissingManifest = validatePackageVerification(makePkgVerify(), undefined);
    assert.equal(vMissingManifest.status, "BLOCKED");
    assert.equal(vMissingManifest.valid, false);

    const report = evaluateProofReport({
      lastRun: makeLastRun({ p0Status: "PASSED", p1Status: "PASSED" }),
      manifest: makeManifest(),
      pkgVerify: undefined,
      currentExamplesCommit: FIXTURE_EXAMPLES_COMMIT,
    });
    assert.equal(report.gates.packageGate, "NOT_RUN");
    assert.equal(report.gates.overallGate, "FAILED");
  });

  it("7. Package verification JSON exists but contains a failed check -> FAILED", () => {
    const badPkgVerify = makePkgVerify();
    badPkgVerify.checks.scaffoldUnitTests = "failed";
    const report = evaluateProofReport({
      lastRun: makeLastRun({ p0Status: "PASSED", p1Status: "PASSED" }),
      manifest: makeManifest(),
      pkgVerify: badPkgVerify,
      currentExamplesCommit: FIXTURE_EXAMPLES_COMMIT,
    });
    assert.equal(report.gates.packageGate, "FAILED");
    assert.equal(report.gates.overallGate, "FAILED");
  });

  it("8. Report belongs to an outdated source commit -> FAILED", () => {
    const staleLastRun = makeLastRun({ p0Status: "PASSED", p1Status: "PASSED" });
    staleLastRun.frameworkSourceCommit = "0000000000000000000000000000000000000000";
    const report = evaluateProofReport({
      lastRun: staleLastRun,
      manifest: makeManifest(),
      pkgVerify: makePkgVerify(),
      currentExamplesCommit: FIXTURE_EXAMPLES_COMMIT,
    });
    assert.equal(report.gates.provenanceGate, "FAILED");
    assert.equal(report.gates.p0Gate, "FAILED");
    assert.equal(report.gates.overallGate, "FAILED");
  });

  it("9. Report belongs to different tarball hashes -> FAILED", () => {
    const mismatchedLastRun = makeLastRun({ p0Status: "PASSED", p1Status: "PASSED" });
    mismatchedLastRun.packageHashes.agboss = "sha512-tamperedHash==";
    const report = evaluateProofReport({
      lastRun: mismatchedLastRun,
      manifest: makeManifest(),
      pkgVerify: makePkgVerify(),
      currentExamplesCommit: FIXTURE_EXAMPLES_COMMIT,
    });
    assert.equal(report.gates.provenanceGate, "FAILED");
    assert.equal(report.gates.p0Gate, "FAILED");
    assert.equal(report.gates.overallGate, "FAILED");
  });

  it("10. Previous successful results cannot hide a failed or missing check in a fresh run", () => {
    const previousSuccessState = makeLastRun({ p0Status: "PASSED", p1Status: "PASSED" });
    const newProvenance = {
      nodeVersion: process.versions.node,
      frameworkSourceCommit: "new-commit-9999999999999999999999999999999999999999",
      examplesSourceCommit: FIXTURE_EXAMPLES_COMMIT,
      frameworkVersion: "0.1.0",
      cliVersion: "0.1.0",
      packageHashes: {
        agboss: FIXTURE_AGBOSS_INTEGRITY,
        agbossSha256: FIXTURE_AGBOSS_SHA256,
        agbossCli: FIXTURE_CLI_INTEGRITY,
        agbossCliSha256: FIXTURE_CLI_SHA256,
      },
    };
    const initialized = initializeOrLoadRunState({
      existingState: previousSuccessState,
      resetState: false,
      provenance: newProvenance,
    });
    assert.notEqual(initialized.runId, previousSuccessState.runId);
    for (const meta of PROJECTS) {
      assert.equal(initialized.projects[meta.name].checkStatus, "NOT_RUN");
      assert.equal(initialized.projects[meta.name].testStatus, "NOT_RUN");
      assert.equal(initialized.projects[meta.name].demoStatus, "NOT_RUN");
    }
  });
});
