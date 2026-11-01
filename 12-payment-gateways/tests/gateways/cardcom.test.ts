import { afterAll, describe } from "vitest";
import { cardcom } from "../../scenarios/gateways.js";
import { gatewayTest, useGateway } from "../../scenarios/harness.js";

// CardCom's documented HTTP API against the CardCom stub: each scenario of its row, one charge, one refund
const { gateway, rows } = await cardcom();
useGateway(gateway);
afterAll(() => gateway.stub.close());

describe("CardCom (its HTTP API v11) through the CardCom stub", () => {
  for (const row of rows) gatewayTest(gateway, row);
});
