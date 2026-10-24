import {
  ModelCost,
  ModelProvider,
  RetryPolicy,
  TRANSIENT_FAILURES,
  type ModelProviderHandler,
  type ModelProviderRequest,
  type ModelProviderResponse,
} from "agboss/models";
import { minutes, seconds, usd } from "agboss/units";

@ModelProvider({
  name: "offline-noop-model-provider",
  description: "Offline zero-cost model provider for pure-action path-scope verification workflows",
  serves: [/.*/],
  timeout: seconds(10),
  cost: ModelCost.fromPrices({
    "offline-model": { inputPerMillion: usd(0.01), outputPerMillion: usd(0.01) },
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
export class OfflineNoopModelProvider implements ModelProviderHandler {
  complete(_request: ModelProviderRequest): Promise<ModelProviderResponse> {
    return Promise.resolve({
      text: "{}",
      usage: { inputTokens: 0, outputTokens: 0 },
    });
  }
}
