import { ModelCost, ModelProvider, RetryPolicy, TRANSIENT_FAILURES } from "agboss/models";
import { minutes, seconds, usd } from "agboss/units";
import { SagaOfflineTransport } from "../../../scripts/tooling/offline-transports.js";
import { waitForChannelAskSent } from "../channels/corporate-booking-approval.channel.js";

@ModelProvider({
  name: "saga-offline-model-provider",
  description: "Deterministic offline transport model provider for travel-booking-saga",
  serves: [/^saga-model$/u],
  timeout: seconds(30),
  cost: ModelCost.fromPrices({
    "saga-model": { inputPerMillion: usd(1), outputPerMillion: usd(2) },
  }),
  retryPolicy: RetryPolicy.exponential({
    maxAttempts: 2,
    initialDelay: seconds(1),
    maxDelay: seconds(5),
    jitter: false,
    retryOn: TRANSIENT_FAILURES,
  }),
  circuitBreakerPolicy: { failureThreshold: 5, window: minutes(1), openFor: seconds(15) },
})
export class SagaOfflineModelProvider extends SagaOfflineTransport {
  protected override waitForChannelAsk = waitForChannelAskSent;
}
