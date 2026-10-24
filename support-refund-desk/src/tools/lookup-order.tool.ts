import { ExecutionContext, Tool, type ToolHandler } from "agboss";
import { seconds } from "agboss/units";
import { OrderDetailsDto, OrderLookupInputDto } from "../workflows/dtos.js";
import { OrderBookService } from "./order-book.service.js";

@Tool({
  name: "lookup-order-tool",
  description: "Looks up an order by orderId and verifies customer email.",
  input: OrderLookupInputDto,
  output: OrderDetailsDto,
  timeout: seconds(10),
  deps: [ExecutionContext, OrderBookService],
})
export class LookupOrderTool implements ToolHandler<OrderLookupInputDto, OrderDetailsDto> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly orderBookService: OrderBookService,
  ) {}

  run(input: OrderLookupInputDto): Promise<OrderDetailsDto> {
    const order = this.orderBookService.findById(input.orderId);
    if (order === undefined) {
      throw new Error(`Order ${input.orderId} not found`);
    }
    this.orderBookService.recordLookup(
      order,
      input.customerEmail,
      this.executionContext.step.idempotencyKey,
    );
    return Promise.resolve({
      orderId: order.orderId,
      tenantId: order.tenantId,
      customerEmail: order.customerEmail,
      item: order.item,
      amountUsd: order.amountUsd,
      daysSincePurchase: order.daysSincePurchase,
      eligibleByWindow: order.daysSincePurchase <= 30,
    });
  }
}
