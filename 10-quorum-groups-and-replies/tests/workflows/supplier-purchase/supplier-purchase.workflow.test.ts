import { BranchStatus, BranchVerdict, PauseKind, QuorumNotReachedError } from "@agboss/core";
import {
  callTool,
  decideWith,
  step,
  TestConcurrency,
  testWith,
  waitFor,
} from "@agboss/core/testing";
import { minutes, seconds, usd } from "@agboss/core/units";
import { describe, expect, vi } from "vitest";
import { DeferPurchaseAction } from "../../../src/actions/defer-purchase.action.js";
import { BudgetCheckAgent } from "../../../src/agents/budget-check/budget-check.agent.js";
import { ComplianceReviewAgent } from "../../../src/agents/compliance-review/compliance-review.agent.js";
import { LegalReviewAgent } from "../../../src/agents/legal-review/legal-review.agent.js";
import { PriceBenchmarkAgent } from "../../../src/agents/price-benchmark/price-benchmark.agent.js";
import { PurchaseOrderAgent } from "../../../src/agents/purchase-order/purchase-order.agent.js";
import { PolicyJudgementArbiter } from "../../../src/arbiters/policy-judgement/policy-judgement.arbiter.js";
import { SupplierPurchaseApplication } from "../../../src/supplier-purchase.application.js";
import { PlacePurchaseOrderTool } from "../../../src/tools/place-purchase-order.tool.js";
import { PurchaseDeferredWorkflowFinish } from "../../../src/workflows/supplier-purchase/purchase-deferred.workflow-finish.js";
import { PurchaseRejectedWorkflowFinish } from "../../../src/workflows/supplier-purchase/purchase-rejected.workflow-finish.js";
import { PurchaseRequestWorkflowStart } from "../../../src/workflows/supplier-purchase/purchase-request.workflow-start.js";
import {
  BUDGET_OK,
  budget,
  compliance,
  COMPLIANCE_OK,
  COMPLIANCE_UNCITED,
  LAPTOP_ORDER, LAPTOPS,
  legal,
  LEGAL_CLEARED,
  price,
  PRICE_FAIR,
} from "../../support/reviews.js";

/**
 * The quorum groups (#279): four reviews at once, each answer through the arbiter chain, the first
 * group complete by priority on its own path. `TestConcurrency.inOrder` fixes the order the
 * branches finish in, so each test is the same run every time. Models by script, $0.
 */

const legalFirst = testWith(SupplierPurchaseApplication, {
  concurrency: TestConcurrency.inOrder([
    step(LegalReviewAgent),
    step(ComplianceReviewAgent),
    step(PriceBenchmarkAgent),
    step(BudgetCheckAgent),
  ]),
});
const commercialFirst = testWith(SupplierPurchaseApplication, {
  concurrency: TestConcurrency.inOrder([
    step(PriceBenchmarkAgent),
    step(BudgetCheckAgent),
    step(LegalReviewAgent),
    step(ComplianceReviewAgent),
  ]),
});

/** One row per branch, as the demo prints it: the agent, its verdict, who rejected it. */
const verdictsOf = (launch: { branches: readonly { nodeId: string; status: BranchStatus; verdict?: BranchVerdict; rejectedBy?: readonly string[] }[] } | undefined) =>
  launch?.branches.map(({ nodeId, status, verdict, rejectedBy }) => ({
    nodeId,
    status,
    ...(verdict === undefined ? {} : { verdict }),
    ...(rejectedBy === undefined ? {} : { rejectedBy }),
  }));

describe("AC2: the first complete group by priority goes on", () => {
  legalFirst(
    "group 1 (legal + compliance) counts first: it goes on to the order, the commercial reviews are cancelled",
    async ({ app, mockLlm }) => {
      mockLlm(LegalReviewAgent).thenReturn(legal());
      mockLlm(ComplianceReviewAgent).thenReturn(compliance());
      mockLlm(PriceBenchmarkAgent).thenReturn(price());
      mockLlm(BudgetCheckAgent).thenReturn(budget());
      mockLlm(PurchaseOrderAgent).thenReturn(callTool(PlacePurchaseOrderTool, LAPTOP_ORDER));

      const result = await app.execute(PurchaseRequestWorkflowStart, LAPTOPS);

      const [launch] = result.launches;
      expect(launch?.isQuorumReached).toBe(true);
      expect(launch?.group).toEqual({
        agents: ["legal-review-agent", "compliance-review-agent"],
        priority: 1,
      });
      expect(verdictsOf(launch)).toEqual([
        { nodeId: "legal-review-agent", status: BranchStatus.Finished, verdict: BranchVerdict.Counted },
        { nodeId: "compliance-review-agent", status: BranchStatus.Finished, verdict: BranchVerdict.Counted },
        { nodeId: "price-benchmark-agent", status: BranchStatus.Cancelled },
        { nodeId: "budget-check-agent", status: BranchStatus.Cancelled },
      ]);
      // the order waits for its approver: the run is paused at the tool call, nothing ordered yet
      expect(result.path.at(-1)).toBe("purchase-order-agent");
      expect(result.pending).toHaveLength(1);
      const [approval] = result.pending;
      // narrow on the kind first: a question's ask is opaque, an approval's is the typed tool call
      if (approval?.kind !== PauseKind.Approval) throw new Error("not paused on the approval");
      expect(approval.step).toBe("purchase-order-agent");
      expect(approval.ask.arguments).toEqual(LAPTOP_ORDER);
    },
  );

  commercialFirst(
    "group 2 completes first, yet group 1 (priority 1) still goes on once it completes",
    async ({ app, mockLlm }) => {
      mockLlm(LegalReviewAgent).thenReturn(legal());
      mockLlm(ComplianceReviewAgent).thenReturn(compliance());
      mockLlm(PriceBenchmarkAgent).thenReturn(price());
      mockLlm(BudgetCheckAgent).thenReturn(budget());
      mockLlm(PurchaseOrderAgent).thenReturn(callTool(PlacePurchaseOrderTool, LAPTOP_ORDER));

      const result = await app.execute(PurchaseRequestWorkflowStart, LAPTOPS);

      const [launch] = result.launches;
      expect(launch?.group?.priority).toBe(1);
      expect(launch?.branches.map((branch) => [branch.nodeId, branch.acceptedSequence])).toEqual([
        ["legal-review-agent", 3],
        ["compliance-review-agent", 4],
        ["price-benchmark-agent", 1],
        ["budget-check-agent", 2],
      ]);
      expect(result.path).not.toContain("defer-purchase-action");
    },
  );
});

describe("AC2 (failure injection): the groups disagree", () => {
  legalFirst(
    "AC2: a compliance answer without a clause is Rejected by well-formed-review-arbiter, and group 2 continues to purchase-deferred-workflow-finish",
    async ({ app, mockLlm }) => {
      mockLlm(LegalReviewAgent).thenReturn(legal());
      mockLlm(ComplianceReviewAgent).thenReturn(compliance(COMPLIANCE_UNCITED));
      mockLlm(PriceBenchmarkAgent).thenReturn(price());
      mockLlm(BudgetCheckAgent).thenReturn(budget());

      const result = await app.execute(PurchaseRequestWorkflowStart, LAPTOPS);

      const [launch] = result.launches;
      expect(launch?.isQuorumReached).toBe(true);
      expect(launch?.group).toEqual({
        agents: ["price-benchmark-agent", "budget-check-agent"],
        priority: 2,
      });
      expect(verdictsOf(launch)).toEqual([
        { nodeId: "legal-review-agent", status: BranchStatus.Finished, verdict: BranchVerdict.Counted },
        {
          nodeId: "compliance-review-agent",
          status: BranchStatus.Finished,
          verdict: BranchVerdict.Rejected,
          rejectedBy: ["well-formed-review-arbiter"],
        },
        { nodeId: "price-benchmark-agent", status: BranchStatus.Finished, verdict: BranchVerdict.Counted },
        { nodeId: "budget-check-agent", status: BranchStatus.Finished, verdict: BranchVerdict.Counted },
      ]);
      expect(result).toFollowPath([
        PurchaseRequestWorkflowStart,
        LegalReviewAgent,
        ComplianceReviewAgent,
        PriceBenchmarkAgent,
        BudgetCheckAgent,
        DeferPurchaseAction,
        PurchaseDeferredWorkflowFinish,
      ]);
      expect(result).toFinishWith(PurchaseDeferredWorkflowFinish, {
        supplier: "Northwind Hardware",
        reason: "the legal and compliance reviews did not both count: the order waits for them",
        benchmarkUsd: 1_250,
        budgetLine: "OPEX-IT-2026",
      });
      // the well-formed arbiter rejects first: the policy arbiters are never asked about it
      expect(mockLlm(PolicyJudgementArbiter).requests).toHaveLength(0);
    },
  );

  legalFirst(
    "AC2: both groups failing ends at purchase-rejected-workflow-finish",
    async ({ app, mockLlm }) => {
      mockLlm(LegalReviewAgent).thenReturn(legal());
      mockLlm(ComplianceReviewAgent).thenReturn(compliance(COMPLIANCE_UNCITED));
      mockLlm(PriceBenchmarkAgent).thenReturn(price());
      mockLlm(BudgetCheckAgent).thenReturn(budget({ ...BUDGET_OK, budgetLine: "" }));

      const result = await app.execute(PurchaseRequestWorkflowStart, LAPTOPS);

      expect(result.launches[0]?.isQuorumReached).toBe(false);
      expect(result).toHaveHandledError(QuorumNotReachedError);
      expect(result).toFinishWith(PurchaseRejectedWorkflowFinish, LAPTOPS);
    },
  );
});

describe("AC2: the arbiter chain — code first, the model only when the code rejects", () => {
  legalFirst(
    "AC2: the model arbiter is asked only when the threshold arbiter rejects",
    async ({ app, mockLlm }) => {
      mockLlm(LegalReviewAgent).thenReturn(legal({ ...LEGAL_CLEARED, isCleared: false, findings: "Liability uncapped; the supplier agreed to sign our rider." }));
      mockLlm(ComplianceReviewAgent).thenReturn(compliance());
      mockLlm(PriceBenchmarkAgent).thenReturn(price());
      mockLlm(BudgetCheckAgent).thenReturn(budget());
      mockLlm(PolicyJudgementArbiter).thenReturn(decideWith({ counts: 0.9 }, { cost: usd(0.00002) }));
      mockLlm(PurchaseOrderAgent).thenReturn(callTool(PlacePurchaseOrderTool, LAPTOP_ORDER));

      const result = await app.execute(PurchaseRequestWorkflowStart, LAPTOPS);

      // one decision: the legal review the thresholds rejected — never the three that cleared them
      expect(mockLlm(PolicyJudgementArbiter).requests).toHaveLength(1);
      expect(result.launches[0]?.group?.priority).toBe(1);
      expect(result.spend.byCaller["arbiter:policy-judgement-arbiter"]).toBe(0.00002);
    },
  );

  legalFirst(
    "every review within the thresholds: the model arbiter is never asked, $0 for arbitration",
    async ({ app, mockLlm }) => {
      mockLlm(LegalReviewAgent).thenReturn(legal());
      mockLlm(ComplianceReviewAgent).thenReturn(compliance());
      mockLlm(PriceBenchmarkAgent).thenReturn(price());
      mockLlm(BudgetCheckAgent).thenReturn(budget());
      mockLlm(PurchaseOrderAgent).thenReturn(callTool(PlacePurchaseOrderTool, LAPTOP_ORDER));

      const result = await app.execute(PurchaseRequestWorkflowStart, LAPTOPS);

      expect(mockLlm(PolicyJudgementArbiter).requests).toHaveLength(0);
      expect(result.spend.byCaller["arbiter:policy-judgement-arbiter"]).toBeUndefined();
    },
  );

  legalFirst(
    "the model arbiter declines too: the review is Rejected by both policy arbiters, group 2 goes on",
    async ({ app, mockLlm }) => {
      mockLlm(LegalReviewAgent).thenReturn(legal());
      mockLlm(ComplianceReviewAgent).thenReturn(compliance({ ...COMPLIANCE_OK, isCompliant: false, findings: "Sanctions hit on the parent company." }));
      mockLlm(PriceBenchmarkAgent).thenReturn(price());
      mockLlm(BudgetCheckAgent).thenReturn(budget());
      mockLlm(PolicyJudgementArbiter).thenReturn(decideWith({ counts: 0.05 }));

      const result = await app.execute(PurchaseRequestWorkflowStart, LAPTOPS);

      const compliant = result.launches[0]?.branches.find(
        (branch) => branch.nodeId === "compliance-review-agent",
      );
      expect(compliant?.verdict).toBe(BranchVerdict.Rejected);
      expect(compliant?.rejectedBy).toEqual(["policy-threshold-arbiter", "policy-judgement-arbiter"]);
      expect(result).toFinishWith(PurchaseDeferredWorkflowFinish, {
        supplier: "Northwind Hardware",
        reason: "the legal and compliance reviews did not both count: the order waits for them",
        benchmarkUsd: PRICE_FAIR.benchmarkUsd,
        budgetLine: BUDGET_OK.budgetLine,
      });
    },
  );
});

describe("the deadline", () => {
  legalFirst(
    "no group complete in 2 minutes: QuorumNotReachedError → purchase-rejected-workflow-finish",
    async ({ app, clock, mockLlm }) => {
      mockLlm(LegalReviewAgent).thenReturn(legal());
      mockLlm(ComplianceReviewAgent).thenReturn(waitFor(minutes(5)), compliance());
      mockLlm(PriceBenchmarkAgent).thenReturn(waitFor(minutes(5)), price());
      mockLlm(BudgetCheckAgent).thenReturn(waitFor(minutes(5)), budget());

      const running = app.execute(PurchaseRequestWorkflowStart, LAPTOPS);
      // the deadline is taken at dispatch: let the launch start before time moves
      await vi.waitFor(() => {
        expect(mockLlm(ComplianceReviewAgent).requests).toHaveLength(1);
      });
      // the holder renews its lease as time passes: advance in steps shorter than the lease
      for (let elapsed = 0; elapsed < 130; elapsed += 10) await clock.advance(seconds(10));
      const result = await running;

      expect(result.launches[0]?.isQuorumReached).toBe(false);
      expect(result).toHaveHandledError(QuorumNotReachedError);
      expect(result).toFinishWith(PurchaseRejectedWorkflowFinish, LAPTOPS);
    },
  );
});
