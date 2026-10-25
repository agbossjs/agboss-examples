import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp, ExecutionStatus } from "agboss";
import { afterAll, describe, expect, it } from "vitest";
import {
  type ExpectedDiagnostic,
  assertDiagnosticMatch,
  assertZeroErrors,
  parseCheckOutput,
} from "../../tooling/assertions/diagnostics.js";
import { runProcess } from "../../tooling/runner/process-runner.js";
import {
  CheckoutRequestDto,
  MissingInputFixedApplication,
  MissingInputFixedStart,
} from "../cases/01-missing-input/agboss-fixed/application.js";
import { buildBrokenMissingInputLangGraph } from "../cases/01-missing-input/langgraph-broken/graph.js";
import {
  OrderDraftDto,
  OutdatedDataFixedApplication,
  OutdatedDataFixedStart,
} from "../cases/02-outdated-data/agboss-fixed/application.js";
import { buildBrokenOutdatedDataLangGraph } from "../cases/02-outdated-data/langgraph-broken/graph.js";
import {
  CartRequestDto,
  ParallelInvalidationFixedApplication,
  ParallelInvalidationFixedStart,
} from "../cases/03-parallel-invalidation/agboss-fixed/application.js";
import { buildBrokenParallelInvalidationLangGraph } from "../cases/03-parallel-invalidation/langgraph-broken/graph.js";
import {
  BookingRequestDto,
  UncompensatedFixedApplication,
  UncompensatedFixedStart,
} from "../cases/04-uncompensated-action/agboss-fixed/application.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");

interface CaseExpectedJson extends ExpectedDiagnostic {
  readonly caseId: string;
}

function loadExpected(caseDirName: string): CaseExpectedJson {
  const raw = readFileSync(
    join(PROJECT_ROOT, "cases", caseDirName, "expected.json"),
    "utf8",
  );
  return JSON.parse(raw) as CaseExpectedJson;
}

async function runAgbossCheck(applicationRelPath: string) {
  const cliBin = join(
    PROJECT_ROOT,
    "node_modules",
    "agboss-cli",
    "bin",
    "agboss.js",
  );
  return await runProcess(
    process.execPath,
    [cliBin, "check", "--json", "--application", applicationRelPath],
    { cwd: PROJECT_ROOT },
  );
}

describe("path-scope-proof — Static Graph Safety & Path-Scope Proofs", () => {
  afterAll(async () => {
    // Restore .agboss/types.d.ts for the full 4-workflow suite
    await runAgbossCheck("src/path-scope-proof.application.ts");
  });

  it("verifies that all 3 LangGraph broken cases pass TypeScript compilation without errors", async () => {
    const tscBin = join(PROJECT_ROOT, "node_modules", "typescript", "bin", "tsc");
    const res = await runProcess(
      process.execPath,
      [
        tscBin,
        "--noEmit",
        "--target",
        "ES2022",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        "--strict",
        "--skipLibCheck",
        "cases/01-missing-input/langgraph-broken/graph.ts",
        "cases/02-outdated-data/langgraph-broken/graph.ts",
        "cases/03-parallel-invalidation/langgraph-broken/graph.ts",
      ],
      { cwd: PROJECT_ROOT },
    );

    expect(res.exitCode, `tsc failed: ${res.stderr}\n${res.stdout}`).toBe(0);
  });

  describe("Case 01 — Missing input on one execution path [input.missing-on-path]", () => {
    it("reproduces runtime TypeError in LangGraph when fast_track skips complianceReview node", async () => {
      const graph = buildBrokenMissingInputLangGraph();
      await expect(
        graph.invoke({
          draft: {
            contractId: "C-101",
            summary: "Fast-track agreement",
            fastTrackRequested: true,
          },
          approval: undefined,
          publishedRecord: undefined,
        }),
      ).rejects.toThrow(/certificateId/u);
    });

    it("detects [input.missing-on-path] statically in agboss-broken before execution", async () => {
      const expected = loadExpected("01-missing-input");
      const res = await runAgbossCheck("cases/01-missing-input/agboss-broken/application.ts");

      expect(res.exitCode).not.toBe(0);
      const report = parseCheckOutput(res.stdout);
      const matched = assertDiagnosticMatch(report, expected);
      expect(matched.code).toBe("input.missing-on-path");
      expect(matched.message).toContain("render-invoice-action");
    });

    it("passes agboss check and executes both VIP and standard branches safely in agboss-fixed", async () => {
      const checkRes = await runAgbossCheck("cases/01-missing-input/agboss-fixed/application.ts");
      expect(checkRes.exitCode, checkRes.stderr || checkRes.stdout).toBe(0);
      assertZeroErrors(parseCheckOutput(checkRes.stdout));

      const app = await createApp(MissingInputFixedApplication);
      try {
        const standardRun = await app.execute(
          MissingInputFixedStart,
          Object.assign(new CheckoutRequestDto(), {
            orderId: "ORD-101",
            tier: "standard",
            subtotalCents: 10_000,
          }),
        );
        expect(standardRun.status).toBe(ExecutionStatus.Finished);
        if (standardRun.status !== ExecutionStatus.Finished) {
          throw new Error("Expected Finished status");
        }
        expect(standardRun.output?.finalTotalCents).toBe(10_000);
        expect(standardRun.output?.invoiceText).toContain("NO-COUPON");

        const vipRun = await app.execute(
          MissingInputFixedStart,
          Object.assign(new CheckoutRequestDto(), {
            orderId: "ORD-102",
            tier: "vip",
            subtotalCents: 10_000,
          }),
        );
        expect(vipRun.status).toBe(ExecutionStatus.Finished);
        if (vipRun.status !== ExecutionStatus.Finished) {
          throw new Error("Expected Finished status");
        }
        expect(vipRun.output?.finalTotalCents).toBe(8_000);
        expect(vipRun.output?.invoiceText).toContain("VIP20");
      } finally {
        await app.close();
      }
    });
  });

  describe("Case 02 — Outdated upstream data after cyclic/re-entry mutation [input.outdated-on-path]", () => {
    it("reproduces stale v1 legal sign-off paired with v2 contract draft in LangGraph", async () => {
      const graph = buildBrokenOutdatedDataLangGraph();
      const state = await graph.invoke({
        topic: "Enterprise MSA",
        draft: undefined,
        legalSignoff: undefined,
        needsRevision: undefined,
        finalizedContract: undefined,
      });

      expect(state.finalizedContract?.draftVersion).toBe(2);
      expect(state.finalizedContract?.signoffVersion).toBe(1);
    });

    it("detects [input.outdated-on-path] statically in agboss-broken before execution", async () => {
      const expected = loadExpected("02-outdated-data");
      const res = await runAgbossCheck("cases/02-outdated-data/agboss-broken/application.ts");

      expect(res.exitCode).not.toBe(0);
      const report = parseCheckOutput(res.stdout);
      const matched = assertDiagnosticMatch(report, expected);
      expect(matched.code).toBe("input.outdated-on-path");
      expect(matched.message).toContain("build-receipt-broken-action");
    });

    it("passes agboss check and recomputes fresh DE shipping quote in agboss-fixed", async () => {
      const checkRes = await runAgbossCheck("cases/02-outdated-data/agboss-fixed/application.ts");
      expect(checkRes.exitCode, checkRes.stderr || checkRes.stdout).toBe(0);
      assertZeroErrors(parseCheckOutput(checkRes.stdout));

      const app = await createApp(OutdatedDataFixedApplication);
      try {
        const result = await app.execute(
          OutdatedDataFixedStart,
          Object.assign(new OrderDraftDto(), {
            orderId: "ORD-201",
            subtotalCents: 10_000,
            destinationCountry: "US",
            requestedCountryChange: "DE",
          }),
        );

        expect(result.status).toBe(ExecutionStatus.Finished);
        if (result.status !== ExecutionStatus.Finished) {
          throw new Error("Expected Finished status");
        }
        expect(result.output?.grandTotalCents).toBe(16_400);
        expect(result.output?.summary).toContain("dest=DE");
        expect(result.output?.summary).toContain("shipFor=DE");
      } finally {
        await app.close();
      }
    });
  });

  describe("Case 03 — Parallel branch invalidating sibling branch input [launch.branch-outdates-sibling]", () => {
    it("reproduces inconsistent tax/subtotal merge across parallel branches in LangGraph", async () => {
      const graph = buildBrokenParallelInvalidationLangGraph();
      const state = await graph.invoke({
        quoteId: "Q-301",
        quoteSheet: undefined,
        taxAuditReport: undefined,
        invoiceSummary: undefined,
      });

      expect(state.invoiceSummary?.subtotalUsd).toBe(850);
      expect(state.invoiceSummary?.auditedSubtotalUsd).toBe(1000);
    });

    it("detects [launch.branch-outdates-sibling] statically in agboss-broken", async () => {
      const expected = loadExpected("03-parallel-invalidation");
      const res = await runAgbossCheck(
        "cases/03-parallel-invalidation/agboss-broken/application.ts",
      );

      expect(res.exitCode).not.toBe(0);
      const report = parseCheckOutput(res.stdout);
      const matched = assertDiagnosticMatch(report, expected);
      expect(matched.code).toBe("launch.branch-outdates-sibling");
      expect(matched.message).toContain("overwrite-quote-branch-a-action");
    });

    it("passes agboss check and reconciles parallel outputs deterministically in agboss-fixed", async () => {
      const checkRes = await runAgbossCheck(
        "cases/03-parallel-invalidation/agboss-fixed/application.ts",
      );
      expect(checkRes.exitCode, checkRes.stderr || checkRes.stdout).toBe(0);
      assertZeroErrors(parseCheckOutput(checkRes.stdout));

      const app = await createApp(ParallelInvalidationFixedApplication);
      try {
        const result = await app.execute(
          ParallelInvalidationFixedStart,
          Object.assign(new CartRequestDto(), {
            cartId: "CART-301",
            baseCents: 10_000,
          }),
        );

        expect(result.status).toBe(ExecutionStatus.Finished);
        if (result.status !== ExecutionStatus.Finished) {
          throw new Error("Expected Finished status");
        }
        expect(result.output?.grandTotalCents).toBe(8_800);
        expect(result.output?.pricingSource).toBe("initial-quote+reconciled-after-join");
      } finally {
        await app.close();
      }
    });
  });

  describe("Case 04 — Uncompensated side effect before error rollback [flow.uncompensated-action]", () => {
    it("detects [flow.uncompensated-action] statically in agboss-broken", async () => {
      const expected = loadExpected("04-uncompensated-action");
      const res = await runAgbossCheck(
        "cases/04-uncompensated-action/agboss-broken/application.ts",
      );

      expect(res.exitCode).not.toBe(0);
      const report = parseCheckOutput(res.stdout);
      const matched = assertDiagnosticMatch(report, expected);
      expect(matched.code).toBe("flow.uncompensated-action");
      expect(matched.message).toContain("reserve-seat-broken-action");
    });

    it("passes agboss check and runs compensation action on error rollback in agboss-fixed", async () => {
      const checkRes = await runAgbossCheck(
        "cases/04-uncompensated-action/agboss-fixed/application.ts",
      );
      expect(checkRes.exitCode, checkRes.stderr || checkRes.stdout).toBe(0);
      assertZeroErrors(parseCheckOutput(checkRes.stdout));

      const app = await createApp(UncompensatedFixedApplication);
      try {
        const declinedRun = await app.execute(
          UncompensatedFixedStart,
          Object.assign(new BookingRequestDto(), {
            bookingId: "BK-401",
            amountCents: 80_000,
          }),
        );

        expect(declinedRun.status).toBe(ExecutionStatus.Finished);
        if (declinedRun.status !== ExecutionStatus.Finished) {
          throw new Error("Expected Finished status");
        }
        expect(declinedRun.output?.status).toBe("COMPENSATED_AND_DECLINED");
        expect(declinedRun.output?.transactionId).toBe("COMPENSATED-RES-BK-401");
      } finally {
        await app.close();
      }
    });
  });
});
