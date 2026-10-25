import { secret } from "agboss";
import { testExecutionContext } from "agboss/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PricingCatalogService,
  startPricingApiStubServer,
  type PricingApiStubServer,
} from "../../src/services/pricing-catalog.service.js";

describe("PricingCatalogService (@Injectable with real HTTP fetch)", () => {
  let apiServer: PricingApiStubServer;

  beforeEach(async () => {
    apiServer = await startPricingApiStubServer();
  });

  afterEach(async () => {
    await apiServer.close();
  });

  function createService(catalogCurrency = "USD", baseUrl = apiServer.baseUrl) {
    const executionCtx = testExecutionContext({
      application: {
        environment: {
          catalogCurrency,
          openRouterApiKey: secret("OPENROUTER_API_KEY"),
          pricingApiBaseUrl: baseUrl,
          sqlitePath: ":memory:",
        },
      },
      executionId: "exec-quote-test-1",
    });
    return {
      service: new PricingCatalogService(executionCtx.tenant.application, executionCtx),
      expectedIdempotencyKey: executionCtx.step.idempotencyKey,
    };
  }

  it("verifies API reachability in async onInit() and rejects invalid URLs", async () => {
    const { service: validService } = createService("USD", apiServer.baseUrl);
    await expect(validService.onInit()).resolves.toBeUndefined();

    const { service: invalidService } = createService("USD", "ftp://invalid-endpoint");
    await expect(invalidService.onInit()).rejects.toThrow(/Invalid pricingApiBaseUrl/u);
  });

  it("performs a real HTTP POST /quotes call passing Idempotency-Key, Authorization, and AbortSignal", async () => {
    const { service, expectedIdempotencyKey } = createService("GBP");
    await service.onInit();

    const proQuote = await service.fetchQuote("pro", 10);
    expect(proQuote).toEqual({
      tier: "pro",
      seats: 10,
      monthlyTotalUsd: 671.5,
      volumeDiscountApplied: true,
      currency: "GBP",
    });

    expect(apiServer.requests).toHaveLength(1);
    expect(apiServer.requests[0]).toMatchObject({
      method: "POST",
      url: "/quotes",
      idempotencyKey: expectedIdempotencyKey,
      body: { tier: "pro", seats: 10, currency: "GBP" },
    });
    expect(apiServer.requests[0]?.authorization).toMatch(/^Bearer /u);
  });

  it("calculates starter and enterprise quotes without discount below 10 seats", async () => {
    const { service } = createService("USD");

    await expect(service.fetchQuote("starter", 1)).resolves.toEqual({
      tier: "starter",
      seats: 1,
      monthlyTotalUsd: 29,
      volumeDiscountApplied: false,
      currency: "USD",
    });
  });
});
