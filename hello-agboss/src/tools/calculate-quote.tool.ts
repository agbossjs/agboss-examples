import { ApplicationContext, ExecutionContext, Injectable, Tool, type ToolHandler } from "agboss";
import { QuoteCalculationInputDto, QuoteCalculationOutputDto } from "../workflows/dtos.js";

const TIER_RATES: Readonly<Record<string, number>> = {
  starter: 29,
  pro: 79,
  enterprise: 199,
};

/**
 * Stateless domain service injected into CalculateQuoteTool via constructor DI.
 * Reads currency configuration from ApplicationContext.environment.
 */
@Injectable({ deps: [ApplicationContext] })
export class PricingCatalogService {
  constructor(private readonly appContext: ApplicationContext) {}

  computeQuote(tierInput: string, seats: number): QuoteCalculationOutputDto {
    const normalizedTier = tierInput.trim().toLowerCase();
    const unitPrice = TIER_RATES[normalizedTier] ?? TIER_RATES["pro"] ?? 79;
    const volumeDiscountApplied = seats >= 10;
    const multiplier = volumeDiscountApplied ? 0.85 : 1;
    const monthlyTotalUsd = Math.round(unitPrice * seats * multiplier * 100) / 100;

    return {
      tier: normalizedTier in TIER_RATES ? normalizedTier : "pro",
      seats,
      monthlyTotalUsd,
      volumeDiscountApplied,
      currency: this.appContext.environment.catalogCurrency,
    };
  }
}

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

  run(input: QuoteCalculationInputDto): Promise<QuoteCalculationOutputDto> {
    this.executionContext.signal.throwIfAborted();
    return Promise.resolve(this.catalog.computeQuote(input.tier, input.seats));
  }
}
