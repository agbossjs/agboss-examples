import type { IncomingMessage } from "node:http";
import { A2ARoute } from "agboss/a2a";
import { testAction, testTool } from "agboss/testing";
import { describe, expect, it } from "vitest";
import { ResolveBillingInquiryAction } from "../../billing-service/actions/resolve-billing-inquiry.action.js";
import { BillingA2aCallerResolver } from "../../billing-service/services/billing-a2a-caller-resolver.service.js";
import { BillingApiKeyDirectory } from "../../billing-service/services/billing-api-key-directory.service.js";
import { BillingWorkflowStart } from "../../billing-service/workflow-starts/billing.workflow-start.js";
import {
  getCatalogExecutionCount,
  resetCatalogExecutionCount
} from "../../catalog-mcp/services/catalog-inventory.service.js";
import { LookupSkuTool } from "../../catalog-mcp/tools/lookup-sku.tool.js";
import { BillingInquiryDto } from "../../src/dto/billing-inquiry.dto.js";
import { SkuLookupInputDto } from "../../src/dto/sku-lookup-input.dto.js";

describe("06-enterprise-agent-mesh — isolated component unit tests", () => {
  it("tests LookupSkuTool in isolation via testTool()", async () => {
    resetCatalogExecutionCount();
    const runLookup = testTool(LookupSkuTool);
    const res = await runLookup(Object.assign(new SkuLookupInputDto(), { sku: "SKU-900" }));
    expect(res.output).toEqual({
      sku: "SKU-900",
      title: "Enterprise Rack Module (SKU-900)",
      unitPriceUsd: 1250,
      inStockUnits: 14
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
          question: "Why was I charged $45 extra?"
        })
      }
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
      http: { headers: {} } as unknown as IncomingMessage
    });
    expect(unauthMissing.kind).toBe("unauthenticated");

    const unauthUnknown = await resolver.resolveCaller({
      route: A2ARoute.Execute,
      http: {
        headers: { authorization: "Bearer invalid-key" }
      } as unknown as IncomingMessage
    });
    expect(unauthUnknown.kind).toBe("unauthenticated");

    const resolved = await resolver.resolveCaller({
      route: A2ARoute.Execute,
      http: {
        headers: { authorization: "Bearer key-acme" }
      } as unknown as IncomingMessage
    });
    expect(resolved.kind).toBe("resolved");

    const forbiddenResume = await resolver.resolveCaller({
      route: A2ARoute.Resume,
      http: {
        headers: { authorization: "Bearer key-readonly" }
      } as unknown as IncomingMessage
    });
    expect(forbiddenResume.kind).toBe("forbidden");
  });
});
