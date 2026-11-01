import { callTool, replyWith, type WorkflowFixtures } from "@agboss/core/testing";
import { expect } from "vitest";
import { BudgetCheckAgent } from "../../src/agents/budget-check/budget-check.agent.js";
import { ComplianceReviewAgent } from "../../src/agents/compliance-review/compliance-review.agent.js";
import { LegalReviewAgent } from "../../src/agents/legal-review/legal-review.agent.js";
import { PriceBenchmarkAgent } from "../../src/agents/price-benchmark/price-benchmark.agent.js";
import { PurchaseOrderAgent } from "../../src/agents/purchase-order/purchase-order.agent.js";
import { PurchaseOrderDto } from "../../src/dto/purchase-order.dto.js";
import { ApproverInbox } from "../../src/services/approver-inbox.service.js";
import { PlacePurchaseOrderTool } from "../../src/tools/place-purchase-order.tool.js";
import { PurchaseRequestWorkflowStart } from "../../src/workflows/supplier-purchase/purchase-request.workflow-start.js";
import { budget, compliance, LAPTOP_ORDER, LAPTOPS, legal, price } from "./reviews.js";

/** The approver's identity on the channel's side: `app.resume(…, { answeredBy })`. */
export const APPROVER = { answeredBy: "approver-dana" };

/** How the order agent reports the end of the run once the tool has answered. */
export const ordered = (amountUsd: number, note = "PO placed") =>
  replyWith(PurchaseOrderDto, { supplier: LAPTOPS.supplier, isOrdered: true, amountUsd, note });
export const notOrdered = (note: string) =>
  replyWith(PurchaseOrderDto, { supplier: LAPTOPS.supplier, isOrdered: false, amountUsd: 0, note });

type Fixtures = Pick<WorkflowFixtures, "app" | "mockLlm" | "mockOf">;

/**
 * Runs the purchase up to its approval: group 1 counts, the order agent calls the tool, the channel
 * posts to the inbox (replaced: the test reads the pause id from what was posted) and the run
 * pauses. Returns the pause's id — the channel's key, which `result.pending` never shows.
 */
export async function pausedAtApproval({ app, mockLlm, mockOf }: Fixtures): Promise<string> {
  mockLlm(LegalReviewAgent).thenReturn(legal());
  mockLlm(ComplianceReviewAgent).thenReturn(compliance());
  mockLlm(PriceBenchmarkAgent).thenReturn(price());
  mockLlm(BudgetCheckAgent).thenReturn(budget());
  mockLlm(PurchaseOrderAgent).thenReturn(callTool(PlacePurchaseOrderTool, LAPTOP_ORDER));
  const inbox = mockOf(ApproverInbox);
  inbox.post.mockResolvedValue(undefined);

  const paused = await app.execute(PurchaseRequestWorkflowStart, LAPTOPS);

  expect(paused.status).toBe("paused");
  const [[posted] = []] = inbox.post.mock.calls;
  if (posted === undefined) throw new Error("the approver was never asked");
  expect(posted).toMatchObject(LAPTOP_ORDER);
  return posted.pauseId;
}
