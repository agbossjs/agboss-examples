import {
  ToolCallDecision,
  ToolInterceptor,
  type BeforeToolCall,
  type ToolCallContext,
} from "agboss";
import { OrderBookService } from "../tools/order-book.service.js";
import { SupportTenantContext } from "../workflows/dtos.js";

@ToolInterceptor({
  name: "refund-policy-tool-interceptor",
  description:
    "Enforces tenant isolation (hard block) and active 30-day / $500 self-service refund caps (replyToModel) before any tool executes.",
  deps: [SupportTenantContext, OrderBookService],
})
export class RefundPolicyToolInterceptor implements BeforeToolCall {
  constructor(
    private readonly supportTenantContext: SupportTenantContext,
    private readonly orderBookService: OrderBookService,
  ) {}

  beforeToolCall(call: ToolCallContext): ToolCallDecision {
    if (typeof call.input !== "object" || call.input === null) {
      return ToolCallDecision.allow();
    }
    const raw = call.input as Record<string, unknown>;
    const orderId = typeof raw.orderId === "string" ? raw.orderId : undefined;
    if (orderId === undefined) {
      return ToolCallDecision.allow();
    }

    const order = this.orderBookService.findById(orderId);
    if (order !== undefined && order.tenantId !== this.supportTenantContext.tenantId) {
      return ToolCallDecision.block({
        reason: `Tenant isolation violation: order ${orderId} belongs to tenant "${order.tenantId}", not caller tenant "${this.supportTenantContext.tenantId}".`,
      });
    }

    if (call.tool.name === "issue-refund-tool") {
      const amountUsd = typeof raw.amountUsd === "number" ? raw.amountUsd : 0;
      const cap = this.supportTenantContext.maxAutoRefundUsd;
      if (amountUsd > cap) {
        return ToolCallDecision.replyToModel({
          message: `Policy rejection [policy-cap]: requested refund $${amountUsd} exceeds the self-service cap of $${cap}. Do not call issue-refund-tool; return decision="escalated" with refundedUsd=0 citing [policy].`,
        });
      }
      if (order !== undefined && order.daysSincePurchase > 30) {
        return ToolCallDecision.replyToModel({
          message: `Policy rejection [policy-window]: order ${orderId} was purchased ${order.daysSincePurchase} days ago, outside the active 30-day window. Return decision="denied" with refundedUsd=0 citing [policy].`,
        });
      }
    }

    return ToolCallDecision.allow();
  }
}
