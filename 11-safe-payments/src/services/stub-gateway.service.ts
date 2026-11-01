import { ApplicationContext, Injectable } from "@agboss/core";
import { StubGatewayClient } from "../stub/stub-gateway.client.js";

/**
 * Where the stub gateway is: its client for the environment's `stubGatewayUrl`. Your project has
 * its gateway's SDK client here instead, configured from its environment.
 */
@Injectable({ deps: [ApplicationContext] })
export class StubGatewayService {
  constructor(private readonly applicationContext: ApplicationContext) {}

  client(): StubGatewayClient {
    return new StubGatewayClient(this.applicationContext.environment.stubGatewayUrl);
  }

  /** The secret webhooks are signed with. */
  webhookSecret(): string {
    return this.applicationContext.environment.stubWebhookSecret.reveal();
  }
}
