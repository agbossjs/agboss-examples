import { ApplicationContext, ExecutionContext, Injectable, secret } from "@agboss/core";
import { override, testTool } from "@agboss/core/testing";
import { usd } from "@agboss/core/units";
import { describe, expect, it } from "vitest";
import { HelloApplicationDailyBudget } from "../../src/budgets/hello-application-daily.budget.js";
import { HelloExecutionBudget } from "../../src/budgets/hello-execution.budget.js";
import { HelloTenantDailyBudget } from "../../src/budgets/hello-tenant-daily.budget.js";
import type { QuoteCalculationOutputDto } from "../../src/dto/quote-calculation-output.dto.js";
import { OpenRouterChatModelProvider } from "../../src/model-providers/openrouter-chat.model-provider.js";
import { PricingCatalogService } from "../../src/services/pricing-catalog.service.js";
import { CalculateQuoteTool } from "../../src/tools/calculate-quote.tool.js";

@Injectable()
class StubPricingCatalogService extends PricingCatalogService {
  constructor() {
    super(
      {
        environment: {
          catalogCurrency: "CHF",
          openRouterApiKey: secret("OPENROUTER_API_KEY"),
          pricingApiBaseUrl: "https://pricing.internal.example",
          sqlitePath: ":memory:",
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
  it("supports dependency replacement via override(PricingCatalogService, ...) with zero network calls", async () => {
    const runWithMockCatalog = testTool(CalculateQuoteTool, {
      overrides: [override(PricingCatalogService, StubPricingCatalogService)],
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

  it("configures OpenRouterChatModelProvider with empty default requestFields", () => {
    const provider = new OpenRouterChatModelProvider();
    expect(provider.requestFields).toEqual({});
  });
});
