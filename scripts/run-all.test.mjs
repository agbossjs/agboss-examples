import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  evaluateProofReport,
  renderProofMarkdown,
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
  computeTarballDigests,
  parseVerifyPublishedArgs,
  validateOfficialRegistryTarballUrl,
  validateRegistryMetadata,
} from "./verify-published.mjs";

const FIXTURE_COMMIT = "a9f27de065f0f145f927bd78daaaff02c06089b0";
const FIXTURE_EXAMPLES_COMMIT = "c187739a00000000000000000000000000000001";
const FIXTURE_AGBOSS_INTEGRITY =
  "sha512-VYryKKwoo/kSAu0Kj+R+EFtxm1iVm8KTy5aDcyRoE89OM7n6dM8qxQUyi71qEI3/pfCyhA8ZfzLRsTFEbQ+7Hg==";
const FIXTURE_AGBOSS_SHA256 = "aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff66667777888899990000";
const FIXTURE_AGBOSS_SHASUM = "28da5ed72ef2870ee8b535abe2c43512f023be97";
const FIXTURE_CLI_INTEGRITY =
  "sha512-HJzFsjjIfpYeEibr2Eo7scYIWadq06WCjyTzGqCWV/2Oiw7q27bsjAJ67ft4TDN+5JaSXTUiAEqs6Jtl9iQQIg==";
const FIXTURE_CLI_SHA256 = "1111aaaa2222bbbb3333cccc4444dddd5555eeee6666ffff7777888899990000";
const FIXTURE_CLI_SHASUM = "7cbce837a502d26b9cb6c356c162fc3385b9965c";

function makeManifest(overrides = {}) {
  return {
    sourceCommit: FIXTURE_COMMIT,
    examplesSourceCommit: FIXTURE_EXAMPLES_COMMIT,
    packages: {
      agboss: {
        name: "@agboss/core",
        version: "0.1.0",
        integrity: FIXTURE_AGBOSS_INTEGRITY,
        sha256: FIXTURE_AGBOSS_SHA256,
        shasum: FIXTURE_AGBOSS_SHASUM,
      },
      agbossCli: {
        name: "@agboss/cli",
        version: "0.1.0",
        integrity: FIXTURE_CLI_INTEGRITY,
        sha256: FIXTURE_CLI_SHA256,
        shasum: FIXTURE_CLI_SHASUM,
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
        shasum: FIXTURE_AGBOSS_SHASUM,
      },
      agbossCli: {
        integrity: FIXTURE_CLI_INTEGRITY,
        sha256: FIXTURE_CLI_SHA256,
        shasum: FIXTURE_CLI_SHASUM,
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
      agbossShasum: FIXTURE_AGBOSS_SHASUM,
      agbossCli: FIXTURE_CLI_INTEGRITY,
      agbossCliSha256: FIXTURE_CLI_SHA256,
      agbossCliShasum: FIXTURE_CLI_SHASUM,
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
      agbossResolved: "https://registry.npmjs.org/@agboss/core/-/core-0.1.0.tgz",
      agbossCliResolved: "https://registry.npmjs.org/@agboss/cli/-/cli-0.1.0.tgz",
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
        name: "@agboss/core",
        version: "0.1.0",
        integrity: FIXTURE_AGBOSS_INTEGRITY,
        sha256: FIXTURE_AGBOSS_SHA256,
        sha256Source: "MEASURED_FROM_REGISTRY_TARBALL",
        shasum: FIXTURE_AGBOSS_SHASUM,
        tarball: "https://registry.npmjs.org/@agboss/core/-/core-0.1.0.tgz",
      },
      agbossCli: {
        name: "@agboss/cli",
        version: "0.1.0",
        integrity: FIXTURE_CLI_INTEGRITY,
        sha256: FIXTURE_CLI_SHA256,
        sha256Source: "MEASURED_FROM_REGISTRY_TARBALL",
        shasum: FIXTURE_CLI_SHASUM,
        tarball: "https://registry.npmjs.org/@agboss/cli/-/cli-0.1.0.tgz",
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
        name: "@agboss/core",
        version: "0.1.0",
        deprecated: null,
        integrity: FIXTURE_AGBOSS_INTEGRITY,
        sha256: FIXTURE_AGBOSS_SHA256,
        sha256Source: "MEASURED_FROM_REGISTRY_TARBALL",
        shasum: FIXTURE_AGBOSS_SHASUM,
        tarball: "https://registry.npmjs.org/@agboss/core/-/core-0.1.0.tgz",
        distTagVersion: "0.1.0",
      },
      agbossCli: {
        name: "@agboss/cli",
        version: "0.1.0",
        deprecated: null,
        integrity: FIXTURE_CLI_INTEGRITY,
        sha256: FIXTURE_CLI_SHA256,
        sha256Source: "MEASURED_FROM_REGISTRY_TARBALL",
        shasum: FIXTURE_CLI_SHASUM,
        tarball: "https://registry.npmjs.org/@agboss/cli/-/cli-0.1.0.tgz",
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
        name: "@agboss/core",
        version: "0.1.0",
        dist: {
          integrity: FIXTURE_AGBOSS_INTEGRITY,
          shasum: FIXTURE_AGBOSS_SHASUM,
          tarball: "https://registry.npmjs.org/@agboss/core/-/core-0.1.0.tgz",
        },
      },
      agbossCliMeta: {
        name: "@agboss/cli",
        version: "0.1.0",
        dependencies: { "@agboss/core": "0.1.0" },
        dist: {
          integrity: FIXTURE_CLI_INTEGRITY,
          shasum: FIXTURE_CLI_SHASUM,
          tarball: "https://registry.npmjs.org/@agboss/cli/-/cli-0.1.0.tgz",
        },
      },
      agbossDistTags: { latest: "0.1.0" },
      agbossCliDistTags: { latest: "0.1.0" },
      measuredTarballs: {
        agboss: {
          sha256: FIXTURE_AGBOSS_SHA256,
          shasum: FIXTURE_AGBOSS_SHASUM,
          integrity: FIXTURE_AGBOSS_INTEGRITY,
          sizeBytes: 1024,
          sha256Source: "MEASURED_FROM_REGISTRY_TARBALL",
        },
        agbossCli: {
          sha256: FIXTURE_CLI_SHA256,
          shasum: FIXTURE_CLI_SHASUM,
          integrity: FIXTURE_CLI_INTEGRITY,
          sizeBytes: 512,
          sha256Source: "MEASURED_FROM_REGISTRY_TARBALL",
        },
      },
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
  mkdirSync(join(nodeModulesDir, "@agboss", "core"), { recursive: true });
  mkdirSync(join(nodeModulesDir, "@agboss", "cli"), { recursive: true });
  writeFileSync(
    join(nodeModulesDir, "@agboss", "core", "package.json"),
    JSON.stringify({ name: "@agboss/core", version: "0.1.0" }),
  );
  writeFileSync(
    join(nodeModulesDir, "@agboss", "cli", "package.json"),
    JSON.stringify({ name: "@agboss/cli", version: "0.1.0" }),
  );
  return { root, repoRoot, projectRoot, packedDir, nodeModulesDir };
}

describe("Provenance-aware scaffold helpers (resolveScaffoldTestConfig & verifyScaffoldInstalledPackages)", () => {
  it("resolves RC tarballs portably from repoRoot/.packed/<filename> even when manifest.json has foreign CI runner paths", () => {
    const ws = createFixtureWorkspace();
    try {
      writeFileSync(join(ws.packedDir, "agboss-core-0.1.0.tgz"), "dummy-core");
      writeFileSync(join(ws.packedDir, "agboss-cli-0.1.0.tgz"), "dummy-cli");
      writeFileSync(
        join(ws.packedDir, "manifest.json"),
        JSON.stringify({
          sourceCommit: FIXTURE_COMMIT,
          packages: {
            agboss: {
              name: "@agboss/core",
              version: "0.1.0",
              filename: "agboss-core-0.1.0.tgz",
              tarballPath: "/home/runner/work/agboss-examples/agboss-examples/.packed/agboss-core-0.1.0.tgz",
              integrity: FIXTURE_AGBOSS_INTEGRITY,
            },
            agbossCli: {
              name: "@agboss/cli",
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
            "node_modules/@agboss/core": {
              version: "0.1.0",
              resolved: "file:../.packed/agboss-core-0.1.0.tgz",
              integrity: FIXTURE_AGBOSS_INTEGRITY,
            },
            "node_modules/@agboss/cli": {
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
      assert.equal(cfg.agbossSpec, `file:${join(ws.repoRoot, ".packed", "agboss-core-0.1.0.tgz")}`);
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
            "node_modules/@agboss/core": {
              version: "0.1.0",
              resolved: "https://registry.npmjs.org/@agboss/core/-/core-0.1.0.tgz",
              integrity: FIXTURE_AGBOSS_INTEGRITY,
            },
            "node_modules/@agboss/cli": {
              version: "0.1.0",
              resolved: "https://registry.npmjs.org/@agboss/cli/-/cli-0.1.0.tgz",
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
        agboss: "https://registry.npmjs.org/@agboss/core/-/core-0.1.0.tgz",
        agbossCli: "https://registry.npmjs.org/@agboss/cli/-/cli-0.1.0.tgz",
      });

      const verified = verifyScaffoldInstalledPackages({
        appDir: ws.projectRoot,
        config: cfg,
      });
      assert.equal(
        verified.agboss.resolved,
        "https://registry.npmjs.org/@agboss/core/-/core-0.1.0.tgz",
      );
      assert.equal(
        verified.agbossCli.resolved,
        "https://registry.npmjs.org/@agboss/cli/-/cli-0.1.0.tgz",
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
        JSON.stringify({ packages: { "node_modules/@agboss/core": { version: "0.1.0" } } }),
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
            "node_modules/@agboss/core": {
              version: "0.1.0",
              resolved: "file:../.packed/agboss-core-0.1.0.tgz",
              integrity: FIXTURE_AGBOSS_INTEGRITY,
            },
            "node_modules/@agboss/cli": {
              version: "0.1.0",
              resolved: "https://registry.npmjs.org/@agboss/cli/-/cli-0.1.0.tgz",
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
            "node_modules/@agboss/core": {
              version: "0.1.0",
              resolved: "https://evil.example.com/@agboss/core/-/core-0.1.0.tgz",
              integrity: FIXTURE_AGBOSS_INTEGRITY,
            },
            "node_modules/@agboss/cli": {
              version: "0.1.0",
              resolved: "https://evil.example.com/@agboss/cli/-/cli-0.1.0.tgz",
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
            "node_modules/@agboss/core": {
              version: "0.1.0",
              resolved: "https://registry.npmjs.org/@agboss/core/-/core-0.1.0.tgz",
              integrity: FIXTURE_AGBOSS_INTEGRITY,
            },
            "node_modules/@agboss/cli": {
              version: "0.1.0",
              resolved: "https://registry.npmjs.org/@agboss/cli/-/cli-0.1.0.tgz",
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
        () => resolvePortablePackedTarballPath(ws.repoRoot, "../agboss-core-0.1.0.tgz", "@agboss/core"),
        /Invalid or unsafe tarball filename/,
      );
      assert.throws(
        () => resolvePortablePackedTarballPath(ws.repoRoot, "sub/agboss-core-0.1.0.tgz", "@agboss/core"),
        /Invalid or unsafe tarball filename/,
      );
      assert.throws(
        () => resolvePortablePackedTarballPath(ws.repoRoot, "agboss-core-0.1.0.zip", "@agboss/core"),
        /Invalid or unsafe tarball filename/,
      );

      // Symlink escape outside node_modules
      const outsideAgboss = join(ws.root, "outside-agboss");
      mkdirSync(outsideAgboss, { recursive: true });
      writeFileSync(
        join(outsideAgboss, "package.json"),
        JSON.stringify({ name: "@agboss/core", version: "0.1.0" }),
      );
      rmSync(join(ws.nodeModulesDir, "@agboss", "core"), { recursive: true, force: true });
      symlinkSync(outsideAgboss, join(ws.nodeModulesDir, "@agboss", "core"));

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

describe("SHA-256 vs SHA-1 digest separation, tarball measurement & negative checksum tests", () => {
  it("computes genuine SHA-256 (64 hex), SHA-1 shasum (40 hex), and SHA-512 SRI integrity from tarball bytes", () => {
    const sampleBytes = Buffer.from("agboss-canonical-tarball-bytes-fixture", "utf8");
    const digests = computeTarballDigests(sampleBytes);
    assert.match(digests.sha256, /^[0-9a-f]{64}$/);
    assert.match(digests.shasum, /^[0-9a-f]{40}$/);
    assert.match(digests.integrity, /^sha512-[A-Za-z0-9+/]+={0,2}$/);
    assert.equal(digests.size, sampleBytes.byteLength);
  });

  it("validates official npm registry tarball URLs and rejects unsafe or non-official URLs", () => {
    assert.equal(
      validateOfficialRegistryTarballUrl(
        "https://registry.npmjs.org/@agboss/core/-/core-0.1.0.tgz",
        "@agboss/core",
        "0.1.0",
      ),
      true,
    );

    assert.equal(
      validateOfficialRegistryTarballUrl(
        "http://registry.npmjs.org/@agboss/core/-/core-0.1.0.tgz",
        "@agboss/core",
        "0.1.0",
      ),
      false,
    );
    assert.equal(
      validateOfficialRegistryTarballUrl(
        "https://evil.example.com/@agboss/core/-/core-0.1.0.tgz",
        "@agboss/core",
        "0.1.0",
      ),
      false,
    );
    assert.equal(
      validateOfficialRegistryTarballUrl(
        "https://registry.npmjs.org/@agboss/core/-/core-0.1.0.tgz?redirect=1",
        "@agboss/core",
        "0.1.0",
      ),
      false,
    );
    assert.equal(
      validateOfficialRegistryTarballUrl(
        "https://user:pass@registry.npmjs.org/@agboss/core/-/core-0.1.0.tgz",
        "@agboss/core",
        "0.1.0",
      ),
      false,
    );
    assert.equal(
      validateOfficialRegistryTarballUrl(
        "https://registry.npmjs.org/@agboss/cli/-/cli-0.1.0.tgz",
        "@agboss/core",
        "0.1.0",
      ),
      false,
    );
  });

  it("enforces measured tarball parity with registry metadata and canonical .packed/manifest.json", () => {
    const baseMeta = {
      agbossMeta: {
        name: "@agboss/core",
        version: "0.1.0",
        dist: {
          integrity: FIXTURE_AGBOSS_INTEGRITY,
          shasum: FIXTURE_AGBOSS_SHASUM,
          tarball: "https://registry.npmjs.org/@agboss/core/-/core-0.1.0.tgz",
        },
      },
      agbossCliMeta: {
        name: "@agboss/cli",
        version: "0.1.0",
        dependencies: { "@agboss/core": "0.1.0" },
        dist: {
          integrity: FIXTURE_CLI_INTEGRITY,
          shasum: FIXTURE_CLI_SHASUM,
          tarball: "https://registry.npmjs.org/@agboss/cli/-/cli-0.1.0.tgz",
        },
      },
      agbossDistTags: { latest: "0.1.0" },
      agbossCliDistTags: { latest: "0.1.0" },
      measuredTarballs: {
        agboss: {
          sha256: FIXTURE_AGBOSS_SHA256,
          shasum: FIXTURE_AGBOSS_SHASUM,
          integrity: FIXTURE_AGBOSS_INTEGRITY,
          size: 1024,
          sha256Source: "MEASURED_FROM_REGISTRY_TARBALL",
        },
        agbossCli: {
          sha256: FIXTURE_CLI_SHA256,
          shasum: FIXTURE_CLI_SHASUM,
          integrity: FIXTURE_CLI_INTEGRITY,
          size: 512,
          sha256Source: "MEASURED_FROM_REGISTRY_TARBALL",
        },
      },
      canonicalManifest: makeManifest(),
      expectedVersion: "0.1.0",
      expectedTag: "latest",
      requireMeasuredTarballs: true,
    };

    const ok = validateRegistryMetadata(baseMeta);
    assert.equal(ok.valid, true);
    assert.equal(ok.summary.agboss.sha256, FIXTURE_AGBOSS_SHA256);
    assert.equal(ok.summary.agboss.shasum, FIXTURE_AGBOSS_SHASUM);
    assert.equal(ok.summary.agbossCli.sha256, FIXTURE_CLI_SHA256);
    assert.equal(ok.summary.agbossCli.shasum, FIXTURE_CLI_SHASUM);

    // Missing measuredTarballs when required -> fails closed
    const missingMeasured = validateRegistryMetadata({
      ...baseMeta,
      measuredTarballs: undefined,
    });
    assert.equal(missingMeasured.valid, false);
    assert.match(missingMeasured.reasons.join("; "), /Missing or invalid measured 64-char SHA-256/);

    // Measured SHA-256 differs from canonical .packed/manifest.json -> fails closed
    const mismatchedCanonical = validateRegistryMetadata({
      ...baseMeta,
      measuredTarballs: {
        ...baseMeta.measuredTarballs,
        agboss: {
          ...baseMeta.measuredTarballs.agboss,
          sha256: "9999999999999999999999999999999999999999999999999999999999999999",
        },
      },
    });
    assert.equal(mismatchedCanonical.valid, false);
    assert.match(
      mismatchedCanonical.reasons.join("; "),
      /does not match canonical CI manifest/,
    );
  });

  it("rejects 40-char SHA-1 in Sha256 fields and 64-char SHA-256 in shasum fields across manifests, verification, and run-state", () => {
    // 1. 40-char SHA-1 placed into publishedManifest.packages.agboss.sha256 -> FAILED
    const sha1InManifestSha256 = makePublishedManifest();
    sha1InManifestSha256.packages.agboss.sha256 = FIXTURE_AGBOSS_SHASUM;
    const mCheck1 = validatePublishedManifest(sha1InManifestSha256, FIXTURE_EXAMPLES_COMMIT);
    assert.equal(mCheck1.valid, false);
    assert.match(mCheck1.reasons.join("; "), /not a 64-character SHA-256 hex digest/);

    // 2. 64-char SHA-256 placed into publishedManifest.packages.agboss.shasum -> FAILED
    const sha256InManifestShasum = makePublishedManifest();
    sha256InManifestShasum.packages.agboss.shasum = FIXTURE_AGBOSS_SHA256;
    const mCheck2 = validatePublishedManifest(sha256InManifestShasum, FIXTURE_EXAMPLES_COMMIT);
    assert.equal(mCheck2.valid, false);
    assert.match(mCheck2.reasons.join("; "), /not a 40-character SHA-1 hex digest/);

    // 3. 40-char SHA-1 placed into lastRun.packageHashes.agbossSha256 (the exact legacy bug) -> FAILED
    const legacyLastRun = makeLastRun({
      p0Status: "PASSED",
      p1Status: "PASSED",
      provenanceType: "PUBLIC_NPM_REGISTRY",
    });
    legacyLastRun.packageHashes.agbossSha256 = FIXTURE_AGBOSS_SHASUM;
    const rLegacy = evaluateProofReport({
      provenanceMode: "published",
      publishedManifest: makePublishedManifest(),
      pubVerify: makePublishedVerification(),
      lastRun: legacyLastRun,
      currentExamplesCommit: FIXTURE_EXAMPLES_COMMIT,
      requireP1: true,
    });
    assert.equal(rLegacy.gates.provenanceGate, "FAILED");
    assert.equal(rLegacy.gates.overallGate, "FAILED");
    assert.match(rLegacy.gateReasons.join("; "), /agbossSha256 is missing, not a 64-character/);

    // 4. 64-char SHA-256 placed into lastRun.packageHashes.agbossShasum -> FAILED
    const badShasumRun = makeLastRun({
      p0Status: "PASSED",
      p1Status: "PASSED",
      provenanceType: "PUBLIC_NPM_REGISTRY",
    });
    badShasumRun.packageHashes.agbossShasum = FIXTURE_AGBOSS_SHA256;
    const rBadShasum = evaluateProofReport({
      provenanceMode: "published",
      publishedManifest: makePublishedManifest(),
      pubVerify: makePublishedVerification(),
      lastRun: badShasumRun,
      currentExamplesCommit: FIXTURE_EXAMPLES_COMMIT,
      requireP1: true,
    });
    assert.equal(rBadShasum.gates.provenanceGate, "FAILED");
    assert.equal(rBadShasum.gates.overallGate, "FAILED");
    assert.match(rBadShasum.gateReasons.join("; "), /agbossShasum is not a 40-character/);

    // 5. Mismatched SHA-256 between publishedManifest and canonical .packed/manifest.json -> FAILED
    const canonicalMismatchManifest = makeManifest();
    canonicalMismatchManifest.packages.agboss.sha256 =
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    const rCanonicalMismatch = evaluateProofReport({
      provenanceMode: "published",
      manifest: canonicalMismatchManifest,
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
    assert.equal(rCanonicalMismatch.gates.provenanceGate, "FAILED");
    assert.equal(rCanonicalMismatch.gates.overallGate, "FAILED");
    assert.match(
      rCanonicalMismatch.gateReasons.join("; "),
      /does not match canonical \.packed\/manifest\.json/,
    );
  });

  it("renders separate SHA-512 integrity, 64-char SHA-256, and 40-char SHA-1 shasum fields in JSON and Markdown reports", () => {
    const report = evaluateProofReport({
      provenanceMode: "published",
      manifest: makeManifest(),
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

    assert.equal(report.gates.overallGate, "PASSED");
    assert.deepEqual(report.packageHashes, {
      agboss: FIXTURE_AGBOSS_INTEGRITY,
      agbossSha256: FIXTURE_AGBOSS_SHA256,
      agbossShasum: FIXTURE_AGBOSS_SHASUM,
      agbossCli: FIXTURE_CLI_INTEGRITY,
      agbossCliSha256: FIXTURE_CLI_SHA256,
      agbossCliShasum: FIXTURE_CLI_SHASUM,
    });

    const md = renderProofMarkdown(report);
    assert.match(md, new RegExp(`\\*\\*agboss integrity \\(SHA-512\\):\\*\\* \`${FIXTURE_AGBOSS_INTEGRITY.replace(/[+/=]/g, "\\$&")}\``));
    assert.match(md, new RegExp(`\\*\\*agboss SHA-256:\\*\\* \`${FIXTURE_AGBOSS_SHA256}\``));
    assert.match(md, new RegExp(`\\*\\*agboss npm shasum \\(SHA-1\\):\\*\\* \`${FIXTURE_AGBOSS_SHASUM}\``));
    assert.match(md, new RegExp(`\\*\\*agboss-cli integrity \\(SHA-512\\):\\*\\* \`${FIXTURE_CLI_INTEGRITY.replace(/[+/=]/g, "\\$&")}\``));
    assert.match(md, new RegExp(`\\*\\*agboss-cli SHA-256:\\*\\* \`${FIXTURE_CLI_SHA256}\``));
    assert.match(md, new RegExp(`\\*\\*agboss-cli npm shasum \\(SHA-1\\):\\*\\* \`${FIXTURE_CLI_SHASUM}\``));
  });
});
