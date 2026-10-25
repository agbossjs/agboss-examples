import { ApplicationContext, Injectable } from "agboss";
import type { QuoteCalculationOutputDto } from "../dto/quote-calculation-output.dto.js";

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
