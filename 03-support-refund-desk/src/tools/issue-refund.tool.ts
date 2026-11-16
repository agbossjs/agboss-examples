import { ExecutionContext, Tool, type ToolHandler } from "@agboss/core";
import { seconds } from "@agboss/core/units";
import { IssueRefundInputDto } from "../dto/issue-refund-input.dto.js";
import { RefundReceiptDto } from "../dto/refund-receipt.dto.js";
import { RefundRefusedError } from "../errors/refund-refused.error.js";
import { OrderBookService } from "../services/order-book.service.js";

@Tool({
  name: "issue-refund-tool",
  description: "Issues a refund for an eligible order within the tenant's self-service policy cap.",
  input: IssueRefundInputDto,
  output: RefundReceiptDto,
  timeout: seconds(10),
  deps: [ExecutionContext, OrderBookService],
})
export class IssueRefundTool implements ToolHandler<IssueRefundInputDto, RefundReceiptDto> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly orderBookService: OrderBookService,
  ) {}

  run(input: IssueRefundInputDto): Promise<RefundReceiptDto> {
    const order = this.orderBookService.findById(input.orderId);
    if (order === undefined) {
      throw new RefundRefusedError("unknown-order", input.orderId);
    }
    // the input is the model's: the order must be the tenant's, the amount the order's to give back
    if (order.tenantId !== this.executionContext.tenant.tenantId) {
      throw new RefundRefusedError("other-tenant", input.orderId);
    }
    if (!(input.amountUsd > 0)) {
      throw new RefundRefusedError("amount-invalid", input.orderId);
    }
    if (input.amountUsd > order.amountUsd) {
      throw new RefundRefusedError("amount-over-order", input.orderId);
    }
    const receipt = this.orderBookService.issueRefund(
      order,
      order.customerEmail,
      input.amountUsd,
      this.executionContext.step.idempotencyKey,
    );
    return Promise.resolve({
      refundId: receipt.refundId,
      orderId: order.orderId,
      refundedUsd: input.amountUsd,
      status: receipt.status,
    });
  }
}
