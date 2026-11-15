import {
  Action,
  ExecutionContext,
  type ActionHandler,
  type InputOf,
  type OutputOf,
} from "@agboss/core";
import { RefundApprovalAskDto } from "../dto/refund-approval-ask.dto.js";
import { RefundApprovalDecisionDto } from "../dto/refund-approval-decision.dto.js";
import { RefundApprovalOutcomeDto } from "../dto/refund-approval-outcome.dto.js";
import { OrderBookService } from "../services/order-book.service.js";

/** Issues the refund when the decision approves it, once per step (the step's idempotency key). */
function settle(
  orderBook: OrderBookService,
  idempotencyKey: string,
  ask: RefundApprovalAskDto,
  decision: RefundApprovalDecisionDto,
  decidedBy: string,
): RefundApprovalOutcomeDto {
  if (!decision.approved) {
    return { orderId: ask.orderId, status: "declined", decidedBy };
  }
  const order = orderBook.findById(ask.orderId);
  if (order === undefined) {
    throw new Error(`Order ${ask.orderId} not found`);
  }
  const receipt = orderBook.issueRefund(order, ask.customerEmail, ask.amountUsd, idempotencyKey);
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
      settle(this.orderBook, this.executionContext.step.idempotencyKey, ask.value, decision.value, "approver"),
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
        this.executionContext.step.idempotencyKey,
        ask.value,
        decision.value,
        "senior-approver",
      ),
    );
  }
}
