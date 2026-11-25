import { ApplicationContext, ExecutionContext, Injectable, secret } from "@agboss/core";
import { testUnit } from "@agboss/core/testing";
import { usd } from "@agboss/core/units";
import { describe, expect, it } from "vitest";
import { HelloApplicationDailyBudget } from "../../src/budgets/hello-application-daily.budget.js";
import { HelloExecutionBudget } from "../../src/budgets/hello-execution.budget.js";
import { HelloTenantDailyBudget } from "../../src/budgets/hello-tenant-daily.budget.js";
import type { QuoteCalculationOutputDto } from "../../src/dto/quote-calculation-output.dto.js";
import { PricingCatalogService } from "../../src/services/pricing-catalog.service.js";
import { CalculateQuoteTool } from "../../src/tools/calculate-quote.tool.js";

@Injectable()
class StubPricingCatalogService extends PricingCatalogService {
  constructor() {
    super(
      {
        environment: {
          catalogCurrency: "CHF",
          pricingApiKey: secret("PRICING_API_KEY"),
          pricingApiBaseUrl: "https://pricing.internal.example",
        },
      } as unknown as ApplicationContext,
      {} as unknown as ExecutionContext,
    );
  }

  override fetchQuote(tier: string, seats: number): Promise<QuoteCalculationOutputDto> {
    return Promise.resolve({
      tier,
      seats,
      monthlyTotalUsd: 420,
      volumeDiscountApplied: true,
      currency: "CHF",
    });
  }
}

describe("CalculateQuoteTool (@Tool unit runner) & supporting components", () => {
  it("supports dependency replacement via services: [StubPricingCatalogService] with zero network calls", async () => {
    const runWithMockCatalog = testUnit(CalculateQuoteTool, {
      services: [StubPricingCatalogService],
    });

    const { output } = await runWithMockCatalog({ tier: "enterprise", seats: 25 });
    expect(output).toEqual({
      tier: "enterprise",
      seats: 25,
      monthlyTotalUsd: 420,
      volumeDiscountApplied: true,
      currency: "CHF",
    });
  });

  it("enforces $5 application daily, $2 tenant daily, and $0.50 per-execution spend limits", () => {
    expect(new HelloApplicationDailyBudget().maxSpend()).toBe(usd(5));
    expect(new HelloTenantDailyBudget().maxSpend()).toBe(usd(2));
    expect(new HelloExecutionBudget().maxSpend()).toBe(usd(0.5));
  });
});
