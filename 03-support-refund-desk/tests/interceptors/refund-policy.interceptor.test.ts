import { ToolCallDecision } from "agboss";
import { testToolInterceptor } from "agboss/testing";
import { describe, expect, it } from "vitest";
import { SupportTenantContext } from "../../src/contexts/support-tenant.context.js";
import {
  AuditTrailToolInterceptor,
  getAuditTrail,
  resetAuditTrail,
} from "../../src/interceptors/audit.interceptor.js";
import { RefundPolicyToolInterceptor } from "../../src/interceptors/refund-policy.interceptor.js";
import { IssueRefundTool } from "../../src/tools/issue-refund.tool.js";
import { LookupOrderTool } from "../../src/tools/lookup-order.tool.js";

describe("Tool Interceptors (@ToolInterceptor unit runner)", () => {
  it("RefundPolicyToolInterceptor enforces tenant isolation, $500 cap, and 30-day window", async () => {
    const interceptor = testToolInterceptor(RefundPolicyToolInterceptor, {
      tenantContext: SupportTenantContext,
      tenant: { tenantId: "acme", maxAutoRefundUsd: 500 },
    });

    const crossTenant = await interceptor.beforeToolCall(LookupOrderTool, {
      orderId: "ORD-2001",
      customerEmail: "carol.synth@example.org",
    });
    expect(crossTenant.output).toEqual(
      ToolCallDecision.block({
        reason:
          'Tenant isolation violation: order ORD-2001 belongs to tenant "globex", not caller tenant "acme".',
      }),
    );

    const overCap = await interceptor.beforeToolCall(IssueRefundTool, {
      orderId: "ORD-1002",
      customerEmail: "alice.synth@example.com",
      amountUsd: 780,
      reason: "Full refund",
    });
    expect(overCap.output).toEqual(
      ToolCallDecision.replyToModel({
        message:
          'Policy rejection [policy-cap]: requested refund $780 exceeds the self-service cap of $500. Do not call issue-refund-tool; return decision="escalated" with refundedUsd=0 citing [policy].',
      }),
    );

    const allowed = await interceptor.beforeToolCall(IssueRefundTool, {
      orderId: "ORD-1001",
      customerEmail: "alice.synth@example.com",
      amountUsd: 180,
      reason: "Damaged item",
    });
    expect(allowed.output).toEqual(ToolCallDecision.allow());
  });

  it("AuditTrailToolInterceptor records completed tool executions", async () => {
    resetAuditTrail();
    const audit = testToolInterceptor(AuditTrailToolInterceptor);
    const { output } = await audit.afterToolCall(
      LookupOrderTool,
      { orderId: "ORD-1001", customerEmail: "alice.synth@example.com" },
      {
        orderId: "ORD-1001",
        tenantId: "tenant-acme",
        customerEmail: "alice.synth@example.com",
        item: "Mechanical Keyboard",
        amountUsd: 180,
        daysSincePurchase: 12,
        eligibleByWindow: true,
      },
    );
    expect(output.orderId).toBe("ORD-1001");
    expect(getAuditTrail()).toHaveLength(1);
    expect(getAuditTrail()[0]?.toolName).toBe("lookup-order-tool");
  });
});
