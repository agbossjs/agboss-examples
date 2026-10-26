import { ModelCost, ModelProvider, RetryPolicy } from "@agboss/core/models";
import { minutes, seconds } from "@agboss/core/units";
import { OfflineNoopTransport } from "../../../../../scripts/tooling/offline-transports.js";

@ModelProvider({
  name: "billing-offline-model-provider",
  description: "Offline model provider for BillingApplication",
  serves: [/^offline\//u],
  timeout: seconds(30),
  cost: ModelCost.fromResponse(),
  retryPolicy: RetryPolicy.none(),
  circuitBreakerPolicy: {
    failureThreshold: 5,
    window: minutes(1),
    openFor: seconds(10),
  },
})
export class BillingOfflineModelProvider extends OfflineNoopTransport {}
