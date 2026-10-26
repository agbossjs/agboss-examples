import { ExecutionContext, Tool, type ToolHandler } from "@agboss/core";
import { seconds } from "@agboss/core/units";
import { IssueRefundInputDto } from "../dto/issue-refund-input.dto.js";
import { RefundReceiptDto } from "../dto/refund-receipt.dto.js";
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
      throw new Error(`Order ${input.orderId} not found`);
    }
    const receipt = this.orderBookService.issueRefund(
      order,
      input.customerEmail,
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
