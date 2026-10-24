import { ExecutionContext, Tool, type ToolHandler } from "agboss";
import { seconds } from "agboss/units";
import { IssueRefundInputDto, RefundReceiptDto } from "../workflows/dtos.js";
import { OrderBookService } from "./order-book.service.js";

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
