import { describe, expect } from "vitest";
import { orderOf } from "../scenarios/checkout.js";
import { outcomeOf, settled } from "../scenarios/outcome.js";
import { scenarioTest } from "../scenarios/run-scenario.js";
import { Variant, type ScenarioRow } from "../scenarios/scenario.types.js";
import { OrderBookRepository } from "../src/repositories/order-book.repository.js";
import { StubLevel } from "../src/stub/stub-gateway.types.js";
import { startWebhookReceiver } from "../src/webhooks/gateway-webhook.receiver.js";
import { CheckoutWorkflowStart } from "../src/workflows/checkout/checkout.workflow-start.js";
import { GatewayEventWorkflowStart } from "../src/workflows/gateway-event/gateway-event.workflow-start.js";

/**
 * A webhook is verified for one tenant (its endpoint, its secret). An event that names another
 * tenant's order — tenant A's charge, delivered to tenant B's endpoint — changes nothing: no row is
 * created for B, A's row is not touched, and no money moves for it.
 */
const row: ScenarioRow = {
  row: "tenancy",
  level: StubLevel.Full,
  right: { charges: 1, captures: 0 },
  async run(context) {
    const order = orderOf("tenant-a-order", 6000, { capture: false });
    const app = context.app(0);
    await app.execute(CheckoutWorkflowStart, order, { tenant: { tenantId: "tenant-a" } });
    const [authorization] = context.stub.chargesOf(order.orderId);
    if (authorization === undefined) throw new Error("no authorization at the stub");
    const books = app.resolve(OrderBookRepository);
    const before = books.order("tenant-a", order.orderId);
    const receiverOfB = await startWebhookReceiver(context.stub.webhookSecret, (event) =>
      app.execute(GatewayEventWorkflowStart, event, { tenant: { tenantId: "tenant-b" } }),
    );
    try {
      const [status] = await context.stub.deliver([context.stub.eventFor("charge.authorized", authorization.chargeId)], { to: receiverOfB.url });
      const after = books.order("tenant-a", order.orderId);
      const createdForB = books.order("tenant-b", order.orderId);
      const notes = [
        `delivery to tenant B: ${String(status)}`,
        `tenant A's row unchanged: ${String(JSON.stringify(before) === JSON.stringify(after))}`,
        `a row created for tenant B: ${String(createdForB !== undefined)}`,
        `directly: ${await settled(app.execute(GatewayEventWorkflowStart, context.stub.eventFor("charge.authorized", authorization.chargeId), { tenant: { tenantId: "tenant-b" } }))}`,
      ];
      return { ...outcomeOf(context, "tenancy", "tenancy", [order.orderId], notes), lost: 0 };
    } finally {
      await receiverOfB.close();
    }
  },
};

describe("a webhook verified for another tenant", () => {
  scenarioTest(row, Variant.Right)("tenant A's order, an event under tenant B: nothing changes, nothing moves", (outcome) => {
    expect([outcome.charges, outcome.captures, outcome.refunds]).toEqual([1, 0, 0]);
    expect(outcome.notes).toEqual([
      "delivery to tenant B: 500",
      "tenant A's row unchanged: true",
      "a row created for tenant B: false",
      expect.stringContaining("payments.not-the-orders-charge"),
    ]);
  });
});
