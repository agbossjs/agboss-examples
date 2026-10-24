import { ExecutionContext, Tool, type ToolHandler } from "agboss";
import { RefundSignOffChannel } from "./channels/refund-sign-off.channel.js";
import {
  OrderFactsDto,
  OrderLookupDto,
  RefundIssuedDto,
  RefundOrderDto,
} from "./support.dto.js";
import { OrderBookService, RefundApiService } from "./support.services.js";

@Tool({
  name: "order-lookup-tool",
  description: "What is known about an order",
  input: OrderLookupDto,
  output: OrderFactsDto,
  deps: [OrderBookService],
})
export class OrderLookupTool implements ToolHandler<OrderLookupDto, OrderFactsDto> {
  constructor(private readonly orderBookService: OrderBookService) {}

  async run({ orderId }: OrderLookupDto): Promise<OrderFactsDto> {
    return { facts: await this.orderBookService.factsOf(orderId) };
  }
}

@Tool({
  name: "issue-signed-off-refund-tool",
  description: "Issues a large refund — a supervisor signs it off first",
  input: RefundOrderDto,
  output: RefundIssuedDto,
  channel: RefundSignOffChannel,
  deps: [RefundApiService, ExecutionContext],
})
export class IssueSignedOffRefundTool
  implements ToolHandler<RefundOrderDto, RefundIssuedDto>
{
  constructor(
    private readonly refundApiService: RefundApiService,
    private readonly executionContext: ExecutionContext,
  ) {}

  async run({ orderId, amountCents }: RefundOrderDto): Promise<RefundIssuedDto> {
    const key: string = this.executionContext.step.idempotencyKey;
    return { refundId: await this.refundApiService.issue(orderId, amountCents, key) };
  }
}
