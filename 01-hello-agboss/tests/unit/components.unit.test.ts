import { ApplicationContext, Injectable, secret } from "agboss";
import { override, testTool } from "agboss/testing";
import { usd } from "agboss/units";
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
    super({
      environment: {
        catalogCurrency: "CHF",
        openRouterApiKey: secret("OPENROUTER_API_KEY"),
        sqlitePath: ":memory:"
      }
    } as unknown as ApplicationContext);
  }

  override computeQuote(tier: string, seats: number): QuoteCalculationOutputDto {
    return {
      tier,
      seats,
      monthlyTotalUsd: 420,
      volumeDiscountApplied: true,
      currency: "CHF"
    };
  }
}

describe("01-hello-agboss — Isolated Component Unit Tests", () => {
  describe("PricingCatalogService (@Injectable)", () => {
    const createCatalog = (catalogCurrency = "USD") =>
      new PricingCatalogService({
        environment: {
          catalogCurrency,
          openRouterApiKey: secret("OPENROUTER_API_KEY"),
          sqlitePath: ":memory:"
        }
      } as unknown as ApplicationContext);

    it("calculates starter, pro, and enterprise quotes without discount below 10 seats", () => {
      const catalog = createCatalog("USD");

      expect(catalog.computeQuote("starter", 1)).toEqual({
        tier: "starter",
        seats: 1,
        monthlyTotalUsd: 29,
        volumeDiscountApplied: false,
        currency: "USD"
      });
      expect(catalog.computeQuote("pro", 9)).toEqual({
        tier: "pro",
        seats: 9,
        monthlyTotalUsd: 711,
        volumeDiscountApplied: false,
        currency: "USD"
      });
      expect(catalog.computeQuote("enterprise", 4)).toEqual({
        tier: "enterprise",
        seats: 4,
        monthlyTotalUsd: 796,
        volumeDiscountApplied: false,
        currency: "USD"
      });
    });

    it("applies 15% volume discount at the 10-seat threshold and respects configured currency", () => {
      const catalog = createCatalog("GBP");

      expect(catalog.computeQuote("pro", 10)).toEqual({
        tier: "pro",
        seats: 10,
        monthlyTotalUsd: 671.5,
        volumeDiscountApplied: true,
        currency: "GBP"
      });
      expect(catalog.computeQuote("enterprise", 10)).toEqual({
        tier: "enterprise",
        seats: 10,
        monthlyTotalUsd: 1691.5,
        volumeDiscountApplied: true,
        currency: "GBP"
      });
    });
  });

  describe("CalculateQuoteTool (@Tool unit runner)", () => {
    it("supports dependency override via override(PricingCatalogService, ...) in unit tests", async () => {
      const runWithMockCatalog = testTool(CalculateQuoteTool, {
        overrides: [override(PricingCatalogService, StubPricingCatalogService)]
      });

      const { output } = await runWithMockCatalog({ tier: "enterprise", seats: 25 });
      expect(output).toEqual({
        tier: "enterprise",
        seats: 25,
        monthlyTotalUsd: 420,
        volumeDiscountApplied: true,
        currency: "CHF"
      });
    });
  });

  describe("Budgets (@Budget)", () => {
    it("enforces $5 application daily, $2 tenant daily, and $0.50 per-execution spend limits", () => {
      expect(new HelloApplicationDailyBudget().maxSpend()).toBe(usd(5));
      expect(new HelloTenantDailyBudget().maxSpend()).toBe(usd(2));
      expect(new HelloExecutionBudget().maxSpend()).toBe(usd(0.5));
    });
  });

  describe("OpenRouterChatModelProvider (@ModelProvider)", () => {
    it("extends OpenRouterProvider with empty default requestFields", () => {
      const provider = new OpenRouterChatModelProvider();
      expect(provider.requestFields).toEqual({});
    });
  });
});
