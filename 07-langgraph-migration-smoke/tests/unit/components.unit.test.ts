import { testAction, testRouter, testTool } from "agboss/testing";
import { describe, expect, it } from "vitest";
import { IssueRefundAction } from "../../src/actions/issue-refund.action.js";
import { RefundSignOffAgent } from "../../src/agents/refund-sign-off/refund-sign-off.agent.js";
import { ReplyWriterAgent } from "../../src/agents/reply-writer/reply-writer.agent.js";
import { OrderLookupDto } from "../../src/dto/order-lookup.dto.js";
import { RefundOrderDto } from "../../src/dto/refund-order.dto.js";
import { ReplyDraftDto } from "../../src/dto/reply-draft.dto.js";
import { SupportRequestDto } from "../../src/dto/support-request.dto.js";
import { RefundSizeRouter } from "../../src/routers/refund-size/refund-size.router.js";
import { SupervisorQueueService } from "../../src/services/supervisor-queue.service.js";
import { IssueSignedOffRefundTool } from "../../src/tools/issue-signed-off-refund.tool.js";
import { OrderLookupTool } from "../../src/tools/order-lookup.tool.js";
import { SupportWorkflowStart } from "../../src/workflow-starts/support.workflow-start.js";

describe("07-langgraph-migration-smoke — isolated component unit tests", () => {
  it("tests OrderLookupTool and IssueSignedOffRefundTool in isolation via testTool()", async () => {
    const runLookup = testTool(OrderLookupTool);
    const facts = await runLookup(Object.assign(new OrderLookupDto(), { orderId: "ORD-7" }));
    expect(facts.output.facts).toContain("order ORD-7: delivered four days late");

    const runSignedOff = testTool(IssueSignedOffRefundTool);
    const issued = await runSignedOff(
      Object.assign(new RefundOrderDto(), {
        orderId: "ORD-7",
        amountCents: 25000
      })
    );
    expect(issued.output.refundId).toContain("refund-ORD-7-25000-");
  });

  it("tests RefundSizeRouter in isolation via testRouter()", async () => {
    const runRouter = testRouter(RefundSizeRouter);

    const small = await runRouter({
      draft: {
        producer: ReplyWriterAgent,
        value: Object.assign(new ReplyDraftDto(), {
          reply: "Refunded $15",
          refundCents: 1500
        })
      }
    });
    expect(small.output).toBe(IssueRefundAction);

    const large = await runRouter({
      draft: {
        producer: ReplyWriterAgent,
        value: Object.assign(new ReplyDraftDto(), {
          reply: "Refunded $250",
          refundCents: 25000
        })
      }
    });
    expect(large.output).toBe(RefundSignOffAgent);
  });

  it("tests IssueRefundAction via testAction() and SupervisorQueueService in isolation", async () => {
    const runIssue = testAction(IssueRefundAction);
    const res = await runIssue({
      request: {
        producer: SupportWorkflowStart,
        value: Object.assign(new SupportRequestDto(), {
          orderId: "ORD-7",
          message: "Late package"
        })
      },
      draft: {
        producer: ReplyWriterAgent,
        value: Object.assign(new ReplyDraftDto(), {
          reply: "Refunded $15",
          refundCents: 1500
        })
      }
    });
    expect(res.output.refundId).toContain("refund-ORD-7-1500-");

    const queue = new SupervisorQueueService();
    await expect(queue.notify("pause-1", "Approve refund")).resolves.toBeUndefined();
  });
});
