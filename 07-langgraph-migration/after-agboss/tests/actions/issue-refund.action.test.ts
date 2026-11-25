import { testUnit } from "@agboss/core/testing";
import { describe, expect, it } from "vitest";
import { IssueRefundAction } from "../../src/actions/issue-refund.action.js";
import { OrderLookupDto } from "../../src/dto/order-lookup.dto.js";
import { RefundOrderDto } from "../../src/dto/refund-order.dto.js";
import { ReplyDraftDto } from "../../src/dto/reply-draft.dto.js";
import { SupportRequestDto } from "../../src/dto/support-request.dto.js";
import { SupervisorQueueService } from "../../src/services/supervisor-queue.service.js";
import { IssueSignedOffRefundTool } from "../../src/tools/issue-signed-off-refund.tool.js";
import { OrderLookupTool } from "../../src/tools/order-lookup.tool.js";

describe("07-langgraph-migration — Isolated Action & Tool Unit Tests", () => {
  it("tests OrderLookupTool and IssueSignedOffRefundTool in isolation via testUnit()", async () => {
    const runLookup = testUnit(OrderLookupTool);
    const facts = await runLookup(Object.assign(new OrderLookupDto(), { orderId: "ORD-7" }));
    expect(facts.output.facts).toContain("order ORD-7: delivered four days late");

    const runSignedOff = testUnit(IssueSignedOffRefundTool);
    const issued = await runSignedOff(
      Object.assign(new RefundOrderDto(), {
        orderId: "ORD-7",
        amountCents: 25000,
      }),
    );
    expect(issued.output.refundId).toContain("refund-ORD-7-25000-");
  });

  it("tests IssueRefundAction via testUnit() and SupervisorQueueService in isolation", async () => {
    const runIssue = testUnit(IssueRefundAction);
    const res = await runIssue({
      request: Object.assign(new SupportRequestDto(), {
          orderId: "ORD-7",
          customerId: "CUST-7",
          customerEmail: "alice@example.com",
          message: "Late package",
        }),
      draft: Object.assign(new ReplyDraftDto(), {
          text: "Refunded $15",
          refundCents: 1500,
        }),
    });
    expect(res.output.refundId).toContain("refund-ORD-7-1500-");

    const queue = new SupervisorQueueService();
    await expect(queue.notify("pause-1", "Approve refund")).resolves.toBeUndefined();
  });
});
