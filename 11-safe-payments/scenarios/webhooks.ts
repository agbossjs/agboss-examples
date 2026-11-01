import { GatewayEventWorkflowStart } from "../src/workflows/gateway-event/gateway-event.workflow-start.js";
import { startWebhookReceiver, type WebhookReceiver } from "../src/webhooks/gateway-webhook.receiver.js";
import type { ScenarioContext } from "./scenario.types.js";

/**
 * The shop's webhook endpoint on both instances: delivery 1 to instance 1, delivery 2 to
 * instance 2, … — two pods behind one load balancer. Each delivery starts a `gateway-event-workflow`.
 */
export function receiverOf(context: ScenarioContext): Promise<WebhookReceiver> {
  return startWebhookReceiver(context.stub.webhookSecret, (event, delivery) =>
    context.app((delivery - 1) % context.apps.length).execute(GatewayEventWorkflowStart, event),
  );
}
