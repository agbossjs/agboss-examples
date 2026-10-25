import {
  ModelCost,
  ModelProvider,
  RetryPolicy,
  type ModelProviderHandler,
  type ModelProviderRequest,
  type ModelProviderResponse,
} from "agboss/models";
import { minutes, seconds } from "agboss/units";

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
export class BillingOfflineModelProvider implements ModelProviderHandler {
  complete(request: ModelProviderRequest): Promise<ModelProviderResponse> {
    void request;
    return Promise.resolve({
      text: "",
      toolCalls: [],
      usage: { inputTokens: 0, outputTokens: 0 },
    });
  }
}
