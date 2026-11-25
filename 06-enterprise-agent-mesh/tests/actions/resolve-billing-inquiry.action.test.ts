import type { IncomingMessage } from "node:http";
import { HttpAuthKind } from "@agboss/core";
import { A2AOperation } from "@agboss/core/a2a";
import { testWith } from "@agboss/core/testing";
import { describe, expect } from "vitest";
import {
  BillingApplication,
  BillingHttpAuthenticator,
  ResolveBillingInquiryAction,
} from "../../apps/2-billing-a2a/src/billing.application.js";
import {
  CatalogApplication,
  getCatalogExecutionCount,
  LookupSkuTool,
  resetCatalogExecutionCount,
} from "../../apps/3-catalog-mcp/src/catalog.application.js";

const billingTest = testWith(BillingApplication);
const catalogTest = testWith(CatalogApplication);

/** The request of a caller with these headers, as the listener hands it to the authenticator. */
const requestOf = (headers: Record<string, string>) =>
  ({ headers }) as unknown as IncomingMessage;

describe("06-enterprise-agent-mesh — Isolated Action, Tool & Authenticator Unit Tests", () => {
  catalogTest("tests LookupSkuTool in isolation via app.runTool()", async ({ app }) => {
    resetCatalogExecutionCount();
    const res = await app.runTool(LookupSkuTool, { sku: "SKU-900" });
    expect(res.output).toEqual({
      kind: "ok",
      value: {
        sku: "SKU-900",
        title: "Enterprise Rack Module (SKU-900)",
        unitPriceUsd: 1250,
        inStockUnits: 14,
      },
    });
    expect(getCatalogExecutionCount()).toBe(1);
  });

  billingTest("tests ResolveBillingInquiryAction in isolation via app.runAction()", async ({ app }) => {
    const res = await app.runAction(ResolveBillingInquiryAction, {
      inquiry: { invoiceId: "INV-2026-88", question: "Why was I charged $45 extra?" },
    });
    expect(res.output).toMatchObject({
      invoiceId: "INV-2026-88",
      creditedUsd: 45,
      resolution: expect.stringContaining("INV-2026-88") as string,
    });
  });

  billingTest("tests BillingHttpAuthenticator in isolation: 401 without a key or with an unknown one, 403 for a read-only key that answers a pause", async ({ app }) => {
    await app.ready();
    const authenticator = app.get(BillingHttpAuthenticator); // the container's instance, its key directory read the environment

    const unauthMissing = await authenticator.authenticate({
      operation: A2AOperation.SendMessage,
      http: requestOf({}),
    });
    expect(unauthMissing.kind).toBe(HttpAuthKind.Unauthenticated);

    const unauthUnknown = await authenticator.authenticate({
      operation: A2AOperation.SendMessage,
      http: requestOf({ authorization: "Bearer invalid-key" }),
    });
    expect(unauthUnknown.kind).toBe(HttpAuthKind.Unauthenticated);

    const resolved = await authenticator.authenticate({
      operation: A2AOperation.SendMessage,
      http: requestOf({ authorization: "Bearer key-acme" }),
    });
    expect(resolved).toMatchObject({
      kind: HttpAuthKind.Authenticated,
      caller: { tenant: { tenantId: "acme" }, ownerId: "triage-gateway-acme" },
    });

    const forbiddenResume = await authenticator.authenticate({
      operation: A2AOperation.SendMessage,
      taskId: "task-1",
      http: requestOf({ authorization: "Bearer key-readonly" }),
    });
    expect(forbiddenResume.kind).toBe(HttpAuthKind.Forbidden);
  });
});
