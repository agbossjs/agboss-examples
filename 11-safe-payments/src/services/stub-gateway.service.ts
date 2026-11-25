import { Injectable, defineEnv, env, secret, type InferEnv } from "@agboss/core";
import { StubGatewayClient } from "../stub/stub-gateway.client.js";

/**
 * Where the stub gateway is, read once when the application starts. The default address is a port nothing
 * listens on: no real gateway is ever called. The webhook secret is optional here — only the webhook receiver
 * reads it, and whoever starts the stub gives it. Your project has its gateway's SDK client here instead,
 * configured from its own variables.
 */
export const stubGatewayEnv = defineEnv({
  /** The stub gateway's base URL (`http://127.0.0.1:<port>`), set by whoever starts it. */
  url: env("STUB_GATEWAY_URL", { default: "http://127.0.0.1:9" }),
  /** The secret the stub signs its webhooks with (`Stub-Signature`). */
  webhookSecret: secret.optional("STUB_WEBHOOK_SECRET"),
});

@Injectable({ deps: [stubGatewayEnv] })
export class StubGatewayService {
  constructor(protected readonly stub: InferEnv<typeof stubGatewayEnv>) {}

  client(): StubGatewayClient {
    return new StubGatewayClient(this.stub.url);
  }

  /** The secret webhooks are signed with; a receiver without one refuses every webhook. */
  webhookSecret(): string {
    const secretOf = this.stub.webhookSecret;
    if (secretOf === undefined) throw new Error("STUB_WEBHOOK_SECRET is not set: no webhook can be verified");
    return secretOf.reveal();
  }
}
