import { afterAll, describe } from "vitest";
import { checkoutCom } from "../../scenarios/gateways.js";
import { gatewayTest, useGateway } from "../../scenarios/harness.js";

// Checkout.com's official SDK against the Checkout.com stub: each scenario of its row, one charge, one refund
const { gateway, rows } = await checkoutCom();
useGateway(gateway);
afterAll(() => gateway.stub.close());

describe("Checkout.com (checkout-sdk-node@5.8.0) through the Checkout.com stub", () => {
  for (const row of rows) gatewayTest(gateway, row);
});
