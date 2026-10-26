import { JudgeVerdict } from "@agboss/core";
import { replyWith, testCompaction, testJudge, testTool } from "@agboss/core/testing";
import { describe, expect, it } from "vitest";
import { PolicyAwareCompaction } from "../../../src/compactions/policy-aware/policy-aware.compaction.js";
import { SupportAnswerDto } from "../../../src/dto/support-answer.dto.js";
import { CitationCodeJudge } from "../../../src/judges/citation-code/citation-code.judge.js";
import { GroundedAnswerJudge } from "../../../src/judges/grounded-answer/grounded-answer.judge.js";
import { InjectionDetectorService } from "../../../src/services/injection-detector.service.js";
import {
  OrderBookService,
  resetRecordedToolOperations,
} from "../../../src/services/order-book.service.js";
import { TicketPatternService } from "../../../src/services/ticket-pattern.service.js";
import { IssueRefundTool } from "../../../src/tools/issue-refund.tool.js";
import { LookupOrderTool } from "../../../src/tools/lookup-order.tool.js";

describe("Judges (@Judge), Compaction (@Compaction), Tools (@Tool) & Domain Services", () => {
  it("PolicyAwareCompaction strips superseded v1.0 policy claims while preserving order IDs", async () => {
    const compact = testCompaction(PolicyAwareCompaction);
    const { output } = await compact({
      previousSummaries: [],
      turnsToCompact: [
        {
          startName: "support-workflow-start",
          input: { message: "Order ORD-1003 under old 90-day policy" },
          finishName: "support-workflow-finish",
          output: { decision: "denied" },
        },
      ],
    });
    expect(output.summaries).toHaveLength(1);
    expect(output.summaries[0]).toContain("order=ORD-1003");
    expect(output.summaries[0]).toContain("SUPERSEDED");
  });

  it("CitationCodeJudge and GroundedAnswerJudge verify [policy] citation and grounding", async () => {
    const runCodeJudge = testJudge(CitationCodeJudge);
    const missingCitation = await runCodeJudge({
      variant: SupportAnswerDto,
      task: "Refund ORD-1001",
      reply: {
        decision: "approved",
        orderId: "ORD-1001",
        refundedUsd: 180,
        explanation: "Approved without citation.",
      },
      attempt: 0,
    });
    expect(missingCitation.output).toEqual(
      JudgeVerdict.failed({
        reason: "Explanation must cite the active refund policy as [policy].",
        metrics: { citesPolicy: false, respectsCap: true },
      }),
    );

    const validCitation = await runCodeJudge({
      variant: SupportAnswerDto,
      task: "Refund ORD-1001",
      reply: {
        decision: "approved",
        orderId: "ORD-1001",
        refundedUsd: 180,
        explanation: "Approved under 30-day window [policy].",
      },
      attempt: 0,
    });
    expect(validCitation.output).toEqual(
      JudgeVerdict.passed({ metrics: { citesPolicy: true, respectsCap: true } }),
    );

    const runModelJudge = testJudge(GroundedAnswerJudge, {
      model: replyWith("PASSED: Grounded in v2.0 policy."),
    });
    const modelVerdict = await runModelJudge({
      variant: SupportAnswerDto,
      task: "Refund ORD-1001",
      reply: {
        decision: "approved",
        orderId: "ORD-1001",
        refundedUsd: 180,
        explanation: "Approved under 30-day window [policy].",
      },
      attempt: 0,
    });
    expect(modelVerdict.output.passed).toBe(true);
  });

  it("LookupOrderTool, IssueRefundTool, and domain services operate deterministically", async () => {
    resetRecordedToolOperations();
    const runLookup = testTool(LookupOrderTool);
    const { output: lookedUp } = await runLookup({
      orderId: "ORD-1001",
      customerEmail: "alice.synth@example.com",
    });
    expect(lookedUp.amountUsd).toBe(180);
    expect(lookedUp.eligibleByWindow).toBe(true);

    const runRefund = testTool(IssueRefundTool);
    const { output: receipt } = await runRefund({
      orderId: "ORD-1001",
      customerEmail: "alice.synth@example.com",
      amountUsd: 180,
      reason: "Eligible refund",
    });
    expect(receipt).toEqual({
      refundId: "REF-ORD-1001-2",
      orderId: "ORD-1001",
      refundedUsd: 180,
      status: "refunded",
    });

    expect(new InjectionDetectorService().isInjectionAttempt("system override")).toBe(true);
    expect(new TicketPatternService().findTicketIds("See TCK-123456")).toEqual([
      { start: 4, end: 14 },
    ]);
    expect(new OrderBookService().findById("ORD-1001")?.tenantId).toBe("acme");
  });
});
