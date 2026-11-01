import { afterAll, describe } from "vitest";
import { stripe } from "../../scenarios/gateways.js";
import { gatewayTest, useGateway } from "../../scenarios/harness.js";

// Stripe's official SDK against the Stripe stub: each scenario of its row, one charge, one refund
const { gateway, rows } = await stripe();
useGateway(gateway);
afterAll(() => gateway.stub.close());

describe("Stripe (stripe@23.1.0) through the Stripe stub", () => {
  for (const row of rows) gatewayTest(gateway, row);
});
