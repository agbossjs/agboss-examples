import { ExecutionContext, Tool, type ToolHandler } from "@agboss/core";
import { QuoteCalculationInputDto } from "../dto/quote-calculation-input.dto.js";
import { QuoteCalculationOutputDto } from "../dto/quote-calculation-output.dto.js";
import { PricingCatalogService } from "../services/pricing-catalog.service.js";

@Tool({
  name: "calculate-quote-tool",
  description: "Calculates a deterministic monthly subscription quote for a plan tier and seat count",
  input: QuoteCalculationInputDto,
  output: QuoteCalculationOutputDto,
  deps: [PricingCatalogService, ExecutionContext],
})
export class CalculateQuoteTool
  implements ToolHandler<QuoteCalculationInputDto, QuoteCalculationOutputDto>
{
  constructor(
    private readonly catalog: PricingCatalogService,
    private readonly executionContext: ExecutionContext,
  ) {}

  async run(input: QuoteCalculationInputDto): Promise<QuoteCalculationOutputDto> {
    this.executionContext.signal.throwIfAborted();
    return this.catalog.fetchQuote(input.tier, input.seats);
  }
}
