import { connect } from "node:tls";
import { afterAll, describe, expect, it } from "vitest";
import { paypal } from "../../scenarios/gateways.js";
import { gatewayTest, useGateway } from "../../scenarios/harness.js";
import { StubTlsAgent } from "../../src/gateways/paypal/paypal-stub-transport.js";

// PayPal's official SDK, its httpsAgent opening TLS to the PayPal stub: each scenario of its row
const { gateway, rows, certificate } = await paypal();
useGateway(gateway, certificate);
afterAll(() => gateway.stub.close());

describe("PayPal (@paypal/paypal-server-sdk@2.5.0) through the PayPal stub, over TLS", () => {
  for (const row of rows) gatewayTest(gateway, row);

  it("the SDK's agent opens every socket to 127.0.0.1, whatever host it is asked for", async () => {
    const port = Number(new URL(gateway.stub.baseUrl).port);
    const socket = new StubTlsAgent(port, certificate).createConnection({ host: "api-m.sandbox.paypal.com", port: 443 }) as ReturnType<typeof connect>;
    await new Promise<void>((resolve, reject) => {
      socket.once("secureConnect", resolve);
      socket.once("error", reject);
    });
    expect([socket.remoteAddress, socket.remotePort, socket.authorized]).toEqual(["127.0.0.1", port, true]);
    socket.destroy();
  });
});
