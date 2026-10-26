import { testRouter } from "@agboss/core/testing";
import { describe, expect, it } from "vitest";
import { IssueRefundAction } from "../../../src/actions/issue-refund.action.js";
import { RefundSignOffAgent } from "../../../src/agents/refund-sign-off/refund-sign-off.agent.js";
import { ReplyWriterAgent } from "../../../src/agents/reply-writer/reply-writer.agent.js";
import { ReplyDraftDto } from "../../../src/dto/reply-draft.dto.js";
import { RefundSizeRouter } from "../../../src/routers/refund-size/refund-size.router.js";

describe("RefundSizeRouter (DecidedBy.Code)", () => {
  it("routes small refunds (<= $100) to IssueRefundAction and large refunds (> $100) to RefundSignOffAgent at $0 cost", async () => {
    const runRouter = testRouter(RefundSizeRouter);

    const small = await runRouter({
      draft: {
        producer: ReplyWriterAgent,
        value: Object.assign(new ReplyDraftDto(), {
          text: "Refunded $15",
          refundCents: 1500,
        }),
      },
    });
    expect(small.output).toBe(IssueRefundAction);

    const large = await runRouter({
      draft: {
        producer: ReplyWriterAgent,
        value: Object.assign(new ReplyDraftDto(), {
          text: "Refunded $250",
          refundCents: 25000,
        }),
      },
    });
    expect(large.output).toBe(RefundSignOffAgent);
  });
});
