import { afterAll, describe } from "vitest";
import { adyen } from "../../scenarios/gateways.js";
import { gatewayTest, useGateway } from "../../scenarios/harness.js";

// Adyen's official SDK against the Adyen stub: each scenario of its row, one charge, one refund
const { gateway, rows } = await adyen();
useGateway(gateway);
afterAll(() => gateway.stub.close());

describe("Adyen (@adyen/api-library@32.2.0) through the Adyen stub", () => {
  for (const row of rows) gatewayTest(gateway, row);
});
