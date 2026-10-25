import { Tool, type ToolHandler } from "agboss";
import { OrderFactsDto } from "../dto/order-facts.dto.js";
import { OrderLookupDto } from "../dto/order-lookup.dto.js";
import { OrderBookService } from "../services/order-book.service.js";

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
