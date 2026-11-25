import { Action, ExecutionContext, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { RefundRefusedError } from "../errors/refund-refused.error.js";
import { RefundApprovalAskDto } from "../dto/refund-approval-ask.dto.js";
import { RefundApprovalDecisionDto } from "../dto/refund-approval-decision.dto.js";
import { RefundApprovalOutcomeDto } from "../dto/refund-approval-outcome.dto.js";
import { OrderBookService } from "../services/order-book.service.js";

/**
 * Issues the refund when the decision approves it, once per step (the step's idempotency key). The
 * ask came from a model or a customer, so nothing in it is trusted: the order is the tenant's own
 * (`RefundRefusedError` otherwise), the amount is positive and at most the order's, and the
 * confirmation goes to the order's email — never an address from the ask.
 */
function settle(
  orderBook: OrderBookService,
  context: ExecutionContext,
  ask: RefundApprovalAskDto,
  decision: RefundApprovalDecisionDto,
  decidedBy: string,
): RefundApprovalOutcomeDto {
  if (!decision.approved) {
    return { orderId: ask.orderId, status: "declined", decidedBy };
  }
  const order = orderBook.findById(ask.orderId);
  if (order === undefined) {
    throw new RefundRefusedError("unknown-order", ask.orderId);
  }
  if (order.tenantId !== context.tenant.tenantId) {
    throw new RefundRefusedError("other-tenant", ask.orderId);
  }
  if (!(ask.amountUsd > 0)) {
    throw new RefundRefusedError("amount-invalid", ask.orderId);
  }
  if (ask.amountUsd > order.amountUsd) {
    throw new RefundRefusedError("amount-over-order", ask.orderId);
  }
  const receipt = orderBook.issueRefund(
    order,
    order.customerEmail,
    ask.amountUsd,
    context.step.idempotencyKey,
  );
  return { orderId: ask.orderId, status: receipt.status, decidedBy, refundId: receipt.refundId };
}

@Action({
  name: "settle-refund-action",
  description: "Issues the refund the first approver approved, or declines it",
  input: { ask: RefundApprovalAskDto, decision: RefundApprovalDecisionDto },
  output: RefundApprovalOutcomeDto,
  deps: [ExecutionContext, OrderBookService],
})
export class SettleRefundAction implements ActionHandler<SettleRefundAction> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly orderBook: OrderBookService,
  ) {}

  execute({ ask, decision }: InputOf<SettleRefundAction>): Promise<OutputOf<SettleRefundAction>> {
    return Promise.resolve(
      settle(this.orderBook, this.executionContext, ask, decision, "approver"),
    );
  }
}

@Action({
  name: "settle-escalated-refund-action",
  description: "Issues the refund the senior approver approved, or declines it",
  input: { ask: RefundApprovalAskDto, decision: RefundApprovalDecisionDto },
  output: RefundApprovalOutcomeDto,
  deps: [ExecutionContext, OrderBookService],
})
export class SettleEscalatedRefundAction implements ActionHandler<SettleEscalatedRefundAction> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly orderBook: OrderBookService,
  ) {}

  execute({
    ask,
    decision,
  }: InputOf<SettleEscalatedRefundAction>): Promise<OutputOf<SettleEscalatedRefundAction>> {
    return Promise.resolve(
      settle(
        this.orderBook,
        this.executionContext,
        ask,
        decision,
        "senior-approver",
      ),
    );
  }
}
