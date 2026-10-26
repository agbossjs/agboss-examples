import type { IncomingMessage } from "node:http";
import { A2ARoute } from "@agboss/core/a2a";
import { testAction, testTool } from "@agboss/core/testing";
import { describe, expect, it } from "vitest";
import {
  BillingA2aCallerResolver,
  BillingApiKeyDirectory,
  BillingInquiryDto,
  BillingWorkflowStart,
  ResolveBillingInquiryAction,
} from "../../apps/2-billing-a2a/src/billing.application.js";
import {
  getCatalogExecutionCount,
  LookupSkuTool,
  resetCatalogExecutionCount,
  SkuLookupInputDto,
} from "../../apps/3-catalog-mcp/src/catalog.application.js";

describe("06-enterprise-agent-mesh — Isolated Action, Tool & Service Unit Tests", () => {
  it("tests LookupSkuTool in isolation via testTool()", async () => {
    resetCatalogExecutionCount();
    const runLookup = testTool(LookupSkuTool);
    const res = await runLookup(Object.assign(new SkuLookupInputDto(), { sku: "SKU-900" }));
    expect(res.output).toEqual({
      sku: "SKU-900",
      title: "Enterprise Rack Module (SKU-900)",
      unitPriceUsd: 1250,
      inStockUnits: 14,
    });
    expect(getCatalogExecutionCount()).toBe(1);
  });

  it("tests ResolveBillingInquiryAction in isolation via testAction()", async () => {
    const runResolve = testAction(ResolveBillingInquiryAction);
    const res = await runResolve({
      inquiry: {
        producer: BillingWorkflowStart,
        value: Object.assign(new BillingInquiryDto(), {
          invoiceId: "INV-2026-88",
          question: "Why was I charged $45 extra?",
        }),
      },
    });
    expect(res.output.invoiceId).toBe("INV-2026-88");
    expect(res.output.creditedUsd).toBe(45);
    expect(res.output.resolution).toContain("INV-2026-88");
  });

  it("tests BillingApiKeyDirectory and BillingA2aCallerResolver in isolation", async () => {
    const directory = new BillingApiKeyDirectory();
    const resolver = new BillingA2aCallerResolver(directory);

    const unauthMissing = await resolver.resolveCaller({
      route: A2ARoute.Execute,
      http: { headers: {} } as unknown as IncomingMessage,
    });
    expect(unauthMissing.kind).toBe("unauthenticated");

    const unauthUnknown = await resolver.resolveCaller({
      route: A2ARoute.Execute,
      http: {
        headers: { authorization: "Bearer invalid-key" },
      } as unknown as IncomingMessage,
    });
    expect(unauthUnknown.kind).toBe("unauthenticated");

    const resolved = await resolver.resolveCaller({
      route: A2ARoute.Execute,
      http: {
        headers: { authorization: "Bearer key-acme" },
      } as unknown as IncomingMessage,
    });
    expect(resolved.kind).toBe("resolved");

    const forbiddenResume = await resolver.resolveCaller({
      route: A2ARoute.Resume,
      http: {
        headers: { authorization: "Bearer key-readonly" },
      } as unknown as IncomingMessage,
    });
    expect(forbiddenResume.kind).toBe("forbidden");
  });
});
