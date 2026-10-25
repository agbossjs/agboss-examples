import {
  ModelCost,
  ModelProvider,
  RetryPolicy,
  type ModelProviderHandler,
  type ModelProviderRequest,
  type ModelProviderResponse,
} from "agboss/models";
import { minutes, seconds, usd } from "agboss/units";

@ModelProvider({
  name: "offline-migration-model-provider",
  description: "Deterministic offline provider serving migrated SupportWorkflow models without API keys.",
  serves: [/^moonshotai\//u],
  timeout: seconds(30),
  cost: ModelCost.fromResponse(),
  retryPolicy: RetryPolicy.none(),
  circuitBreakerPolicy: {
    failureThreshold: 5,
    window: minutes(1),
    openFor: seconds(10),
  },
})
export class OfflineMigrationModelProvider implements ModelProviderHandler {
  complete(request: ModelProviderRequest): Promise<ModelProviderResponse> {
    const answerTool = request.tools[0]?.name ?? "answer";
    return Promise.resolve({
      text: "",
      toolCalls: [
        {
          id: "call_offline_1",
          name: answerTool,
          arguments: {},
        },
      ],
      usage: { inputTokens: 20, outputTokens: 10 },
      cost: usd(0.0001),
    });
  }
}
