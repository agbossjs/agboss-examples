import {
  DtoValidationError,
  ExecutionStatus,
  PausedExecutionRepository,
  PauseStatus,
  UninterpretableReplyError,
} from "@agboss/core";
import { ToolCallApprovalDecisionDto } from "@agboss/core/dto";
import { replyWith, step, TestConcurrency, testWith } from "@agboss/core/testing";
import { usd } from "@agboss/core/units";
import { describe, expect } from "vitest";
import { BudgetCheckAgent } from "../../../src/agents/budget-check/budget-check.agent.js";
import { ComplianceReviewAgent } from "../../../src/agents/compliance-review/compliance-review.agent.js";
import { LegalReviewAgent } from "../../../src/agents/legal-review/legal-review.agent.js";
import { PriceBenchmarkAgent } from "../../../src/agents/price-benchmark/price-benchmark.agent.js";
import { PurchaseOrderAgent } from "../../../src/agents/purchase-order/purchase-order.agent.js";
import { PurchaseReplyInterpreter } from "../../../src/reply-interpreters/purchase/purchase.reply-interpreter.js";
import { SupplierPurchaseApplication } from "../../../src/supplier-purchase.application.js";
import { PurchaseOrderedWorkflowFinish } from "../../../src/workflows/supplier-purchase/purchase-ordered.workflow-finish.js";
import { APPROVER, notOrdered, ordered, pausedAtApproval } from "../../support/approval.js";
import { LAPTOP_ORDER } from "../../support/reviews.js";

/**
 * The approval in free text (#267 PR 3): the order waits on `PurchaseApproverChannel`, the approver
 * answers in words, `PurchaseReplyInterpreter` reads them into the typed decision before anything
 * resumes. Its model is scripted by the reply (`mockLlm(…).when({ reply })`).
 */

const test = testWith(SupplierPurchaseApplication, {
  concurrency: TestConcurrency.inOrder([
    step(LegalReviewAgent),
    step(ComplianceReviewAgent),
    step(PriceBenchmarkAgent),
    step(BudgetCheckAgent),
  ]),
});

const CAPPED = { ...LAPTOP_ORDER, amountUsd: 500 };

describe("AC3: a free-text approval becomes a typed decision and the run resumes", () => {
  test("AC3: 'ok but only up to $500' resumes with the amount capped at 500, and the order is capped", async ({ app, mockLlm, mockOf }) => {
    const pauseId = await pausedAtApproval({ app, mockLlm, mockOf });
    mockLlm(PurchaseReplyInterpreter)
      .when({ reply: "ok but only up to $500" })
      .thenReturn(
        replyWith(
          ToolCallApprovalDecisionDto,
          { approved: true, reason: "only up to $500", overrideArguments: CAPPED },
          { cost: usd(0.00003) },
        ),
      );
    mockLlm(PurchaseOrderAgent).thenReturn(ordered(500));

    const done = await app.resume({ pauseId, reply: "ok but only up to $500" }, APPROVER);

    expect(done.status).toBe(ExecutionStatus.Finished);
    expect(done).toFinishWith(PurchaseOrderedWorkflowFinish, {
      supplier: "Northwind Hardware",
      isOrdered: true,
      amountUsd: 500,
      note: "PO placed",
    });
    // the tool ran with the approved arguments, not the asked ones
    const [placed] = done.toolCalls;
    expect(placed?.input).toEqual(CAPPED);
    expect(placed?.output).toMatchObject({ amountUsd: 500 });
    // the interpreter read the pause's question with the reply
    expect(mockLlm(PurchaseReplyInterpreter).inputs).toEqual([
      {
        ask: expect.objectContaining({ tool: "place-purchase-order-tool", arguments: LAPTOP_ORDER }) as unknown,
        reply: "ok but only up to $500",
      },
    ]);
    expect(done.spend.byCaller["reply-interpreter:purchase-reply-interpreter"]).toBe(0.00003);
  });

  test("a plain approval keeps the amount asked", async ({ app, mockLlm, mockOf }) => {
    const pauseId = await pausedAtApproval({ app, mockLlm, mockOf });
    mockLlm(PurchaseReplyInterpreter).thenReturn(
      replyWith(ToolCallApprovalDecisionDto, { approved: true }),
    );
    mockLlm(PurchaseOrderAgent).thenReturn(ordered(1_200));

    const done = await app.resume({ pauseId, reply: "approved, go ahead" }, APPROVER);

    expect(done.toolCalls[0]?.input).toEqual(LAPTOP_ORDER);
    expect(done.output).toMatchObject({ isOrdered: true, amountUsd: 1_200 });
  });

  test("AC3: a refusal reply ends without an order", async ({ app, mockLlm, mockOf }) => {
    const pauseId = await pausedAtApproval({ app, mockLlm, mockOf });
    mockLlm(PurchaseReplyInterpreter).thenReturn(
      replyWith(ToolCallApprovalDecisionDto, { approved: false, reason: "we froze hardware spend" }),
    );
    mockLlm(PurchaseOrderAgent).thenReturn(notOrdered("we froze hardware spend"));

    const done = await app.resume({ pauseId, reply: "no — we froze hardware spend" }, APPROVER);

    expect(done).toFinishWith(PurchaseOrderedWorkflowFinish, {
      supplier: "Northwind Hardware",
      isOrdered: false,
      amountUsd: 0,
      note: "we froze hardware spend",
    });
    // the tool never ran: the model read the refusal as its result
    expect(done.toolCalls.map((call) => call.status)).not.toContain("succeeded");
    expect(JSON.stringify(mockLlm(PurchaseOrderAgent).lastRequest)).toContain("we froze hardware spend");
  });
});

describe("AC3: an unreadable reply never resumes the run", () => {
  test("AC3: an unreadable reply rejects with UninterpretableReplyError, the pause stays pending, and a second reply resumes", async ({ app, mockLlm, mockOf }) => {
    const pauseId = await pausedAtApproval({ app, mockLlm, mockOf });
    const interpreter = mockLlm(PurchaseReplyInterpreter);
    // the model gives no decision on "🤷" (text instead of its answer tool), then reads a clear reply
    interpreter.when({ reply: "🤷" }).thenReturn(replyWith("I cannot tell whether this approves."));
    interpreter
      .when({ reply: "yes, up to $500" })
      .thenReturn(
        replyWith(ToolCallApprovalDecisionDto, { approved: true, overrideArguments: CAPPED }),
      );
    mockLlm(PurchaseOrderAgent).thenReturn(ordered(500));

    await expect(app.resume({ pauseId, reply: "🤷" }, APPROVER)).rejects.toBeInstanceOf(
      UninterpretableReplyError,
    );
    const stored = await app
      .resolve(PausedExecutionRepository)
      .findByTenantIdAndPauseId("default", pauseId);
    expect(stored?.status).toBe(PauseStatus.Pending);
    expect(mockLlm(PurchaseOrderAgent).requests).toHaveLength(1); // nothing ran after the pause

    const done = await app.resume({ pauseId, reply: "yes, up to $500" }, APPROVER);

    expect(done.status).toBe(ExecutionStatus.Finished);
    expect(done.toolCalls[0]?.input).toEqual(CAPPED);
  });

  test("an invalid decision (a cap above the order's schema) is unreadable too: the pause stays pending", async ({ app, mockLlm, mockOf }) => {
    const pauseId = await pausedAtApproval({ app, mockLlm, mockOf });
    mockLlm(PurchaseReplyInterpreter).thenReturn(
      replyWith(ToolCallApprovalDecisionDto, {
        approved: true,
        overrideArguments: { ...LAPTOP_ORDER, amountUsd: -5 },
      }),
    );

    await expect(app.resume({ pauseId, reply: "ok, minus five" }, APPROVER)).rejects.toBeInstanceOf(
      UninterpretableReplyError,
    );
    const stored = await app
      .resolve(PausedExecutionRepository)
      .findByTenantIdAndPauseId("default", pauseId);
    expect(stored?.status).toBe(PauseStatus.Pending);
  });

  test("an empty reply is refused before the interpreter is asked", async ({ app, mockLlm, mockOf }) => {
    const pauseId = await pausedAtApproval({ app, mockLlm, mockOf });

    await expect(app.resume({ pauseId, reply: "" }, APPROVER)).rejects.toBeInstanceOf(
      DtoValidationError,
    );
    expect(mockLlm(PurchaseReplyInterpreter).requests).toHaveLength(0);
  });
});
