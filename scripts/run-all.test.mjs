import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  evaluateProofReport,
  validatePackageVerification,
  validatePublishedManifest,
  validatePublishedVerification,
} from "./collect-results.mjs";
import { parsePinShaArgs } from "./pin-framework-sha.mjs";
import {
  PROJECTS,
  initializeOrLoadRunState,
  parseRunAllArgs,
  resolvePortablePackedTarballPath,
  resolveScaffoldTestConfig,
  selectProjects,
  verifyScaffoldInstalledPackages,
} from "./run-all.mjs";
import {
  REQUIRED_SUBPATH_EXPORTS,
  parseVerifyPublishedArgs,
  validateRegistryMetadata,
} from "./verify-published.mjs";

const FIXTURE_COMMIT = "a9f27de065f0f145f927bd78daaaff02c06089b0";
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
      subpathExportsVerified: [...REQUIRED_SUBPATH_EXPORTS],
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

function makeLastRun({
  p0Status = "PASSED",
  p1Status = "PASSED",
  provenanceType = "RELEASE_CANDIDATE",
  overrides = {},
} = {}) {
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
    provenanceType,
    frameworkSourceCommit:
      provenanceType === "PUBLIC_NPM_REGISTRY" ? "PUBLIC_NPM_REGISTRY" : FIXTURE_COMMIT,
    examplesSourceCommit: FIXTURE_EXAMPLES_COMMIT,
    frameworkVersion: "0.1.0",
    cliVersion: "0.1.0",
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

function makePublishedManifest(overrides = {}) {
  const projects = {};
  for (const meta of PROJECTS) {
    projects[meta.name] = {
      project: meta.name,
      installedAt: "2026-10-25T20:00:00.000Z",
      agbossVersion: "0.1.0",
      agbossCliVersion: "0.1.0",
      agbossIntegrity: FIXTURE_AGBOSS_INTEGRITY,
      agbossCliIntegrity: FIXTURE_CLI_INTEGRITY,
      agbossResolved: "https://registry.npmjs.org/agboss/-/agboss-0.1.0.tgz",
      agbossCliResolved: "https://registry.npmjs.org/agboss-cli/-/agboss-cli-0.1.0.tgz",
      isRegistryInstall: true,
      hasLocalLinks: false,
    };
  }
  return {
    schemaVersion: "2.0",
    provenanceType: "PUBLIC_NPM_REGISTRY",
    source: "PUBLIC_NPM_REGISTRY",
    installedAt: "2026-10-25T20:00:00.000Z",
    examplesSourceCommit: FIXTURE_EXAMPLES_COMMIT,
    requestedVersion: "0.1.0",
    requestedDistTag: "latest",
    packages: {
      agboss: {
        name: "agboss",
        version: "0.1.0",
        integrity: FIXTURE_AGBOSS_INTEGRITY,
        shasum: FIXTURE_AGBOSS_SHA256,
        tarball: "https://registry.npmjs.org/agboss/-/agboss-0.1.0.tgz",
      },
      agbossCli: {
        name: "agboss-cli",
        version: "0.1.0",
        integrity: FIXTURE_CLI_INTEGRITY,
        shasum: FIXTURE_CLI_SHA256,
        tarball: "https://registry.npmjs.org/agboss-cli/-/agboss-cli-0.1.0.tgz",
      },
    },
    projects,
    ...overrides,
  };
}

function makePublishedVerification(overrides = {}) {
  return {
    schemaVersion: "2.0",
    status: "PASSED",
    source: "PUBLIC_NPM_REGISTRY",
    verificationMode: "live-registry",
    registryVerified: true,
    requestedVersion: "0.1.0",
    requestedDistTag: "latest",
    examplesSourceCommit: FIXTURE_EXAMPLES_COMMIT,
    npmRegistryMetadata: {
      agboss: {
        name: "agboss",
        version: "0.1.0",
        deprecated: null,
        integrity: FIXTURE_AGBOSS_INTEGRITY,
        shasum: FIXTURE_AGBOSS_SHA256,
        tarball: "https://registry.npmjs.org/agboss/-/agboss-0.1.0.tgz",
        distTagVersion: "0.1.0",
      },
      agbossCli: {
        name: "agboss-cli",
        version: "0.1.0",
        deprecated: null,
        integrity: FIXTURE_CLI_INTEGRITY,
        shasum: FIXTURE_CLI_SHA256,
        tarball: "https://registry.npmjs.org/agboss-cli/-/agboss-cli-0.1.0.tgz",
        distTagVersion: "0.1.0",
      },
    },
    checks: {
      registryMetadata: "passed",
      isolatedConsumerInstall: "passed",
      subpathExportsVerified: [...REQUIRED_SUBPATH_EXPORTS],
      cliBinVersion: "passed",
      cliBinHelp: "passed",
      cliExplicitBinHelp: "passed",
      cleanScaffoldCreate: "passed",
      scaffoldFilesVerified: [
        "package.json",
        "tsconfig.json",
        "eslint.config.js",
        "AGENTS.md",
        "CLAUDE.md",
      ],
      generatedTypesVerified: true,
      syncedAiSkillsCount: 13,
      scaffoldCheck: "passed",
      scaffoldTypecheck: "passed",
      scaffoldUnitTests: "passed",
      scaffoldDescribe: "passed",
    },
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

  it("parses mode, includeP1, projectFilter, resetState, and provenance flags accurately", () => {
    assert.deepEqual(parseRunAllArgs([]), {
      mode: "test",
      includeP1: false,
      projectFilter: undefined,
      resetState: false,
      provenance: "rc",
    });
    assert.deepEqual(
      parseRunAllArgs([
        "--mode",
        "demo",
        "--include-p1",
        "--project",
        "06-enterprise-agent-mesh",
        "--reset",
        "--provenance",
        "published",
      ]),
      {
        mode: "demo",
        includeP1: true,
        projectFilter: "06-enterprise-agent-mesh",
        resetState: true,
        provenance: "published",
      },
    );
    assert.throws(() => parseRunAllArgs(["--provenance", "invalid"]), /Invalid --provenance/);
  });
});

describe("verify-published.mjs explicit mode & registry metadata validation (P0-2)", () => {
  it("requires an explicit mode flag (--from-packed or --live-registry) and rejects missing or conflicting flags", () => {
    assert.throws(
      () => parseVerifyPublishedArgs(["--version", "0.1.0"]),
      /Missing required mode flag/,
    );
    assert.throws(
      () => parseVerifyPublishedArgs(["--from-packed", "--live-registry", "--version", "0.1.0"]),
      /Conflicting mode flags/,
    );
    assert.throws(
      () => parseVerifyPublishedArgs(["--live-registry"]),
      /Missing or invalid --version/,
    );
    assert.throws(
      () => parseVerifyPublishedArgs(["--live-registry", "--version", "not-semver"]),
      /Missing or invalid --version/,
    );
    assert.throws(
      () => parseVerifyPublishedArgs(["--live-registry", "--version", "0.1.0", "--unknown"]),
      /Unknown or ambiguous argument/,
    );

    assert.deepEqual(parseVerifyPublishedArgs(["--from-packed", "--version", "0.1.0"]), {
      mode: "from-packed",
      sourceLabel: "LOCAL_PACKED_RELEASE_CANDIDATE",
      version: "0.1.0",
      tag: "latest",
    });
    assert.deepEqual(parseVerifyPublishedArgs(["--live-registry", "--version", "0.1.0"]), {
      mode: "live-registry",
      sourceLabel: "PUBLIC_NPM_REGISTRY",
      version: "0.1.0",
      tag: "latest",
    });
  });

  it("validates live npm registry metadata and fails closed on deprecated, missing, or mismatched versions", () => {
    const validMeta = {
      agbossMeta: {
        name: "agboss",
        version: "0.1.0",
        dist: {
          integrity: FIXTURE_AGBOSS_INTEGRITY,
          shasum: FIXTURE_AGBOSS_SHA256,
          tarball: "https://registry.npmjs.org/agboss/-/agboss-0.1.0.tgz",
        },
      },
      agbossCliMeta: {
        name: "agboss-cli",
        version: "0.1.0",
        dist: {
          integrity: FIXTURE_CLI_INTEGRITY,
          shasum: FIXTURE_CLI_SHA256,
          tarball: "https://registry.npmjs.org/agboss-cli/-/agboss-cli-0.1.0.tgz",
        },
      },
      agbossDistTags: { latest: "0.1.0" },
      agbossCliDistTags: { latest: "0.1.0" },
      expectedVersion: "0.1.0",
      expectedTag: "latest",
    };

    const ok = validateRegistryMetadata(validMeta);
    assert.equal(ok.valid, true);
    assert.equal(ok.reasons.length, 0);

    // Deprecated version fails closed
    const deprecated = validateRegistryMetadata({
      ...validMeta,
      agbossMeta: { ...validMeta.agbossMeta, deprecated: "Initial setup placeholder" },
    });
    assert.equal(deprecated.valid, false);
    assert.match(deprecated.reasons.join("; "), /deprecated/i);

    // Wrong version or dist-tag fails closed
    const wrongTag = validateRegistryMetadata({
      ...validMeta,
      agbossDistTags: { latest: "0.0.1" },
    });
    assert.equal(wrongTag.valid, false);
    assert.match(wrongTag.reasons.join("; "), /dist-tag 'latest'/);

    // Local file: tarball URL fails closed
    const localUrl = validateRegistryMetadata({
      ...validMeta,
      agbossCliMeta: {
        ...validMeta.agbossCliMeta,
        dist: { ...validMeta.agbossCliMeta.dist, tarball: "file:/tmp/agboss-cli-0.1.0.tgz" },
      },
    });
    assert.equal(localUrl.valid, false);
    assert.match(localUrl.reasons.join("; "), /non-registry dist\.tarball/);
  });

  it("validates 40-char git SHA in pin-framework-sha.mjs (P1-1)", () => {
    assert.throws(() => parsePinShaArgs([]), /Invalid or missing --sha/);
    assert.throws(() => parsePinShaArgs(["--sha", "short123"]), /Invalid or missing --sha/);
    assert.deepEqual(
      parsePinShaArgs(["--sha", FIXTURE_COMMIT.toUpperCase(), "--branch", "main"]),
      { sha: FIXTURE_COMMIT, branch: "main" },
    );
  });
});

describe("collect-results.mjs fail-closed release proof gates (RC mode: 10 required scenarios)", () => {
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
      provenanceType: "RELEASE_CANDIDATE",
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

describe("Published-package provenance separation & negative tests (P0-3)", () => {
  it("passes published gate ONLY when published-manifest, live-registry published-verification, and published last-run all pass", () => {
    const report = evaluateProofReport({
      provenanceMode: "published",
      publishedManifest: makePublishedManifest(),
      pubVerify: makePublishedVerification(),
      lastRun: makeLastRun({
        p0Status: "PASSED",
        p1Status: "PASSED",
        provenanceType: "PUBLIC_NPM_REGISTRY",
      }),
      currentExamplesCommit: FIXTURE_EXAMPLES_COMMIT,
      requireP1: true,
    });
    assert.equal(report.provenanceType, "PUBLIC_NPM_REGISTRY");
    assert.equal(report.gates.provenanceGate, "PASSED");
    assert.equal(report.gates.packageGate, "PASSED");
    assert.equal(report.gates.p0Gate, "PASSED");
    assert.equal(report.gates.p1Gate, "PASSED");
    assert.equal(report.gates.overallGate, "PASSED");
  });

  it("1. Stale RC report cannot satisfy published gate -> FAILED", () => {
    const staleRcRun = makeLastRun({
      p0Status: "PASSED",
      p1Status: "PASSED",
      provenanceType: "RELEASE_CANDIDATE",
    });
    const report = evaluateProofReport({
      provenanceMode: "published",
      publishedManifest: makePublishedManifest(),
      pubVerify: makePublishedVerification(),
      lastRun: staleRcRun,
      currentExamplesCommit: FIXTURE_EXAMPLES_COMMIT,
      requireP1: true,
    });
    assert.equal(report.gates.provenanceGate, "FAILED");
    assert.equal(report.gates.overallGate, "FAILED");
    assert.match(report.gateReasons.join("; "), /Stale RC run results cannot satisfy/);

    // Also initializeOrLoadRunState resets all statuses to NOT_RUN when switching from RC to PUBLIC_NPM_REGISTRY
    const resetOnSwitch = initializeOrLoadRunState({
      existingState: staleRcRun,
      resetState: false,
      provenance: {
        provenanceType: "PUBLIC_NPM_REGISTRY",
        nodeVersion: process.versions.node,
        frameworkSourceCommit: "PUBLIC_NPM_REGISTRY",
        examplesSourceCommit: FIXTURE_EXAMPLES_COMMIT,
        frameworkVersion: "0.1.0",
        cliVersion: "0.1.0",
        packageHashes: staleRcRun.packageHashes,
      },
    });
    for (const meta of PROJECTS) {
      assert.equal(resetOnSwitch.projects[meta.name].checkStatus, "NOT_RUN");
      assert.equal(resetOnSwitch.projects[meta.name].testStatus, "NOT_RUN");
      assert.equal(resetOnSwitch.projects[meta.name].demoStatus, "NOT_RUN");
    }
  });

  it("2. Pre-release --from-packed published-verification.json cannot satisfy published gate -> FAILED", () => {
    const packedVerify = makePublishedVerification({
      source: "LOCAL_PACKED_RELEASE_CANDIDATE",
      verificationMode: "from-packed",
      registryVerified: false,
    });
    const vCheck = validatePublishedVerification(packedVerify, makePublishedManifest());
    assert.equal(vCheck.valid, false);
    assert.equal(vCheck.status, "FAILED");

    const report = evaluateProofReport({
      provenanceMode: "published",
      publishedManifest: makePublishedManifest(),
      pubVerify: packedVerify,
      lastRun: makeLastRun({
        p0Status: "PASSED",
        p1Status: "PASSED",
        provenanceType: "PUBLIC_NPM_REGISTRY",
      }),
      currentExamplesCommit: FIXTURE_EXAMPLES_COMMIT,
      requireP1: true,
    });
    assert.equal(report.gates.packageGate, "FAILED");
    assert.equal(report.gates.overallGate, "FAILED");
  });

  it("3. Missing registry metadata or missing published-manifest.json fails closed -> BLOCKED / FAILED", () => {
    const mCheck = validatePublishedManifest(undefined, FIXTURE_EXAMPLES_COMMIT);
    assert.equal(mCheck.status, "BLOCKED");
    assert.equal(mCheck.valid, false);

    const missingIntegrityManifest = makePublishedManifest();
    missingIntegrityManifest.packages.agboss.integrity = null;
    const report = evaluateProofReport({
      provenanceMode: "published",
      publishedManifest: missingIntegrityManifest,
      pubVerify: makePublishedVerification(),
      lastRun: makeLastRun({
        p0Status: "PASSED",
        p1Status: "PASSED",
        provenanceType: "PUBLIC_NPM_REGISTRY",
      }),
      currentExamplesCommit: FIXTURE_EXAMPLES_COMMIT,
      requireP1: true,
    });
    assert.equal(report.gates.provenanceGate, "FAILED");
    assert.equal(report.gates.overallGate, "FAILED");
  });

  it("4. Wrong installed package version fails closed -> FAILED", () => {
    const wrongVerManifest = makePublishedManifest();
    wrongVerManifest.projects["03-support-refund-desk"].agbossVersion = "0.0.1";
    const report = evaluateProofReport({
      provenanceMode: "published",
      publishedManifest: wrongVerManifest,
      pubVerify: makePublishedVerification(),
      lastRun: makeLastRun({
        p0Status: "PASSED",
        p1Status: "PASSED",
        provenanceType: "PUBLIC_NPM_REGISTRY",
      }),
      currentExamplesCommit: FIXTURE_EXAMPLES_COMMIT,
      requireP1: true,
    });
    assert.equal(report.gates.provenanceGate, "FAILED");
    assert.equal(report.gates.overallGate, "FAILED");
    assert.match(report.gateReasons.join("; "), /installed agboss@0\.0\.1/);
  });

  it("5. Mixed tarball / registry installation fails closed -> FAILED", () => {
    const mixedManifest = makePublishedManifest();
    mixedManifest.projects["05-cluster-work-stealing"].isRegistryInstall = false;
    mixedManifest.projects["05-cluster-work-stealing"].hasLocalLinks = true;
    mixedManifest.projects["05-cluster-work-stealing"].agbossResolved =
      "file:../.packed/agboss-0.1.0.tgz";

    const report = evaluateProofReport({
      provenanceMode: "published",
      publishedManifest: mixedManifest,
      pubVerify: makePublishedVerification(),
      lastRun: makeLastRun({
        p0Status: "PASSED",
        p1Status: "PASSED",
        provenanceType: "PUBLIC_NPM_REGISTRY",
      }),
      currentExamplesCommit: FIXTURE_EXAMPLES_COMMIT,
      requireP1: true,
    });
    assert.equal(report.gates.provenanceGate, "FAILED");
    assert.equal(report.gates.overallGate, "FAILED");
    assert.match(report.gateReasons.join("; "), /non-registry or mixed tarball/);
  });

  it("6. Missing tests, partial execution, P0 skipped, P1 skipped with --require-p1, or failed demo -> FAILED", () => {
    const partialRun = makeLastRun({
      p0Status: "PASSED",
      p1Status: "PASSED",
      provenanceType: "PUBLIC_NPM_REGISTRY",
    });
    partialRun.projects["02-path-scope-proof"].testStatus = "NOT_RUN";
    const r1 = evaluateProofReport({
      provenanceMode: "published",
      publishedManifest: makePublishedManifest(),
      pubVerify: makePublishedVerification(),
      lastRun: partialRun,
      currentExamplesCommit: FIXTURE_EXAMPLES_COMMIT,
      requireP1: true,
    });
    assert.equal(r1.gates.p0Gate, "FAILED");
    assert.equal(r1.gates.overallGate, "FAILED");

    const p1SkippedRun = makeLastRun({
      p0Status: "PASSED",
      p1Status: "SKIPPED",
      provenanceType: "PUBLIC_NPM_REGISTRY",
    });
    const r2 = evaluateProofReport({
      provenanceMode: "published",
      publishedManifest: makePublishedManifest(),
      pubVerify: makePublishedVerification(),
      lastRun: p1SkippedRun,
      currentExamplesCommit: FIXTURE_EXAMPLES_COMMIT,
      requireP1: true,
    });
    assert.equal(r2.gates.p1Gate, "FAILED");
    assert.equal(r2.gates.overallGate, "FAILED");
  });
});

function createFixtureWorkspace() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "agboss-scaffold-prov-test-")));
  const repoRoot = join(root, "repo");
  const projectRoot = join(repoRoot, "01-hello-agboss");
  const packedDir = join(repoRoot, ".packed");
  const nodeModulesDir = join(projectRoot, "node_modules");
  mkdirSync(packedDir, { recursive: true });
  mkdirSync(join(nodeModulesDir, "agboss"), { recursive: true });
  mkdirSync(join(nodeModulesDir, "agboss-cli"), { recursive: true });
  writeFileSync(
    join(nodeModulesDir, "agboss", "package.json"),
    JSON.stringify({ name: "agboss", version: "0.1.0" }),
  );
  writeFileSync(
    join(nodeModulesDir, "agboss-cli", "package.json"),
    JSON.stringify({ name: "agboss-cli", version: "0.1.0" }),
  );
  return { root, repoRoot, projectRoot, packedDir, nodeModulesDir };
}

describe("Provenance-aware scaffold helpers (resolveScaffoldTestConfig & verifyScaffoldInstalledPackages)", () => {
  it("resolves RC tarballs portably from repoRoot/.packed/<filename> even when manifest.json has foreign CI runner paths", () => {
    const ws = createFixtureWorkspace();
    try {
      writeFileSync(join(ws.packedDir, "agboss-0.1.0.tgz"), "dummy-core");
      writeFileSync(join(ws.packedDir, "agboss-cli-0.1.0.tgz"), "dummy-cli");
      writeFileSync(
        join(ws.packedDir, "manifest.json"),
        JSON.stringify({
          sourceCommit: FIXTURE_COMMIT,
          packages: {
            agboss: {
              name: "agboss",
              version: "0.1.0",
              filename: "agboss-0.1.0.tgz",
              tarballPath: "/home/runner/work/agboss-examples/agboss-examples/.packed/agboss-0.1.0.tgz",
              integrity: FIXTURE_AGBOSS_INTEGRITY,
            },
            agbossCli: {
              name: "agboss-cli",
              version: "0.1.0",
              filename: "agboss-cli-0.1.0.tgz",
              tarballPath: "/home/runner/work/agboss-examples/agboss-examples/.packed/agboss-cli-0.1.0.tgz",
              integrity: FIXTURE_CLI_INTEGRITY,
            },
          },
        }),
      );
      writeFileSync(
        join(ws.nodeModulesDir, ".package-lock.json"),
        JSON.stringify({
          packages: {
            "node_modules/agboss": {
              version: "0.1.0",
              resolved: "file:../.packed/agboss-0.1.0.tgz",
              integrity: FIXTURE_AGBOSS_INTEGRITY,
            },
            "node_modules/agboss-cli": {
              version: "0.1.0",
              resolved: "file:../.packed/agboss-cli-0.1.0.tgz",
              integrity: FIXTURE_CLI_INTEGRITY,
            },
          },
        }),
      );

      const cfg = resolveScaffoldTestConfig({
        projectRoot: ws.projectRoot,
        repoRoot: ws.repoRoot,
        env: { AGBOSS_PROVENANCE_MODE: "rc" },
      });

      assert.equal(cfg.provenance, "rc");
      assert.equal(cfg.useOverrides, true);
      assert.equal(cfg.agbossSpec, `file:${join(ws.repoRoot, ".packed", "agboss-0.1.0.tgz")}`);
      assert.equal(cfg.cliSpec, `file:${join(ws.repoRoot, ".packed", "agboss-cli-0.1.0.tgz")}`);
      assert.deepEqual(cfg.expectedVersion, { agboss: "0.1.0", agbossCli: "0.1.0" });
      assert.deepEqual(cfg.expectedIntegrity, {
        agboss: FIXTURE_AGBOSS_INTEGRITY,
        agbossCli: FIXTURE_CLI_INTEGRITY,
      });

      const verified = verifyScaffoldInstalledPackages({
        appDir: ws.projectRoot,
        config: cfg,
      });
      assert.equal(verified.agboss.version, "0.1.0");
      assert.equal(verified.agbossCli.version, "0.1.0");
    } finally {
      rmSync(ws.root, { recursive: true, force: true });
    }
  });

  it("resolves published registry packages without reading .packed/manifest.json or local tarballs", () => {
    const ws = createFixtureWorkspace();
    try {
      writeFileSync(
        join(ws.packedDir, "published-manifest.json"),
        JSON.stringify(makePublishedManifest()),
      );
      writeFileSync(
        join(ws.nodeModulesDir, ".package-lock.json"),
        JSON.stringify({
          packages: {
            "node_modules/agboss": {
              version: "0.1.0",
              resolved: "https://registry.npmjs.org/agboss/-/agboss-0.1.0.tgz",
              integrity: FIXTURE_AGBOSS_INTEGRITY,
            },
            "node_modules/agboss-cli": {
              version: "0.1.0",
              resolved: "https://registry.npmjs.org/agboss-cli/-/agboss-cli-0.1.0.tgz",
              integrity: FIXTURE_CLI_INTEGRITY,
            },
          },
        }),
      );

      const cfg = resolveScaffoldTestConfig({
        projectRoot: ws.projectRoot,
        repoRoot: ws.repoRoot,
        env: { AGBOSS_PROVENANCE_MODE: "published" },
      });

      assert.equal(cfg.provenance, "published");
      assert.equal(cfg.useOverrides, false);
      assert.equal(cfg.agbossSpec, "0.1.0");
      assert.equal(cfg.cliSpec, "0.1.0");
      assert.deepEqual(cfg.expectedResolved, {
        agboss: "https://registry.npmjs.org/agboss/-/agboss-0.1.0.tgz",
        agbossCli: "https://registry.npmjs.org/agboss-cli/-/agboss-cli-0.1.0.tgz",
      });

      const verified = verifyScaffoldInstalledPackages({
        appDir: ws.projectRoot,
        config: cfg,
      });
      assert.equal(
        verified.agboss.resolved,
        "https://registry.npmjs.org/agboss/-/agboss-0.1.0.tgz",
      );
      assert.equal(
        verified.agbossCli.resolved,
        "https://registry.npmjs.org/agboss-cli/-/agboss-cli-0.1.0.tgz",
      );
    } finally {
      rmSync(ws.root, { recursive: true, force: true });
    }
  });

  it("rejects mixed, unknown, or missing lockfile provenance and mismatched AGBOSS_PROVENANCE_MODE", () => {
    const ws = createFixtureWorkspace();
    try {
      // Missing lockfile
      assert.throws(
        () =>
          resolveScaffoldTestConfig({
            projectRoot: ws.projectRoot,
            repoRoot: ws.repoRoot,
            env: {},
          }),
        /Missing package-lock\.json/,
      );

      // Missing lockfile entries
      writeFileSync(
        join(ws.nodeModulesDir, ".package-lock.json"),
        JSON.stringify({ packages: { "node_modules/agboss": { version: "0.1.0" } } }),
      );
      assert.throws(
        () =>
          resolveScaffoldTestConfig({
            projectRoot: ws.projectRoot,
            repoRoot: ws.repoRoot,
            env: {},
          }),
        /Missing lockfile entries/,
      );

      // Mixed provenance (file: + https://)
      writeFileSync(
        join(ws.nodeModulesDir, ".package-lock.json"),
        JSON.stringify({
          packages: {
            "node_modules/agboss": {
              version: "0.1.0",
              resolved: "file:../.packed/agboss-0.1.0.tgz",
              integrity: FIXTURE_AGBOSS_INTEGRITY,
            },
            "node_modules/agboss-cli": {
              version: "0.1.0",
              resolved: "https://registry.npmjs.org/agboss-cli/-/agboss-cli-0.1.0.tgz",
              integrity: FIXTURE_CLI_INTEGRITY,
            },
          },
        }),
      );
      assert.throws(
        () =>
          resolveScaffoldTestConfig({
            projectRoot: ws.projectRoot,
            repoRoot: ws.repoRoot,
            env: {},
          }),
        /Unknown or mixed installed package provenance/,
      );

      // Unknown registry host
      writeFileSync(
        join(ws.nodeModulesDir, ".package-lock.json"),
        JSON.stringify({
          packages: {
            "node_modules/agboss": {
              version: "0.1.0",
              resolved: "https://evil.example.com/agboss/-/agboss-0.1.0.tgz",
              integrity: FIXTURE_AGBOSS_INTEGRITY,
            },
            "node_modules/agboss-cli": {
              version: "0.1.0",
              resolved: "https://evil.example.com/agboss-cli/-/agboss-cli-0.1.0.tgz",
              integrity: FIXTURE_CLI_INTEGRITY,
            },
          },
        }),
      );
      assert.throws(
        () =>
          resolveScaffoldTestConfig({
            projectRoot: ws.projectRoot,
            repoRoot: ws.repoRoot,
            env: {},
          }),
        /Unknown or mixed installed package provenance/,
      );

      // Mismatched explicit AGBOSS_PROVENANCE_MODE (installed published vs explicit rc)
      writeFileSync(
        join(ws.nodeModulesDir, ".package-lock.json"),
        JSON.stringify({
          packages: {
            "node_modules/agboss": {
              version: "0.1.0",
              resolved: "https://registry.npmjs.org/agboss/-/agboss-0.1.0.tgz",
              integrity: FIXTURE_AGBOSS_INTEGRITY,
            },
            "node_modules/agboss-cli": {
              version: "0.1.0",
              resolved: "https://registry.npmjs.org/agboss-cli/-/agboss-cli-0.1.0.tgz",
              integrity: FIXTURE_CLI_INTEGRITY,
            },
          },
        }),
      );
      assert.throws(
        () =>
          resolveScaffoldTestConfig({
            projectRoot: ws.projectRoot,
            repoRoot: ws.repoRoot,
            env: { AGBOSS_PROVENANCE_MODE: "rc" },
          }),
        /Provenance mismatch/,
      );
      assert.throws(
        () =>
          resolveScaffoldTestConfig({
            projectRoot: ws.projectRoot,
            repoRoot: ws.repoRoot,
            env: { AGBOSS_PROVENANCE_MODE: "invalid" },
          }),
        /Invalid AGBOSS_PROVENANCE_MODE/,
      );
    } finally {
      rmSync(ws.root, { recursive: true, force: true });
    }
  });

  it("rejects unsafe tarball filenames and symlink escapes outside node_modules", () => {
    const ws = createFixtureWorkspace();
    try {
      assert.throws(
        () => resolvePortablePackedTarballPath(ws.repoRoot, "../agboss-0.1.0.tgz", "agboss"),
        /Invalid or unsafe tarball filename/,
      );
      assert.throws(
        () => resolvePortablePackedTarballPath(ws.repoRoot, "sub/agboss-0.1.0.tgz", "agboss"),
        /Invalid or unsafe tarball filename/,
      );
      assert.throws(
        () => resolvePortablePackedTarballPath(ws.repoRoot, "agboss-0.1.0.zip", "agboss"),
        /Invalid or unsafe tarball filename/,
      );

      // Symlink escape outside node_modules
      const outsideAgboss = join(ws.root, "outside-agboss");
      mkdirSync(outsideAgboss, { recursive: true });
      writeFileSync(
        join(outsideAgboss, "package.json"),
        JSON.stringify({ name: "agboss", version: "0.1.0" }),
      );
      rmSync(join(ws.nodeModulesDir, "agboss"), { recursive: true, force: true });
      symlinkSync(outsideAgboss, join(ws.nodeModulesDir, "agboss"));

      assert.throws(
        () =>
          resolveScaffoldTestConfig({
            projectRoot: ws.projectRoot,
            repoRoot: ws.repoRoot,
            env: {},
          }),
        /resolves outside node_modules/,
      );
    } finally {
      rmSync(ws.root, { recursive: true, force: true });
    }
  });
});
