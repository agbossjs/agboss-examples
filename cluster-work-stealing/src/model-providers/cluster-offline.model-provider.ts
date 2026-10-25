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
  name: "cluster-offline-model-provider",
  description: "Deterministic offline model provider for cluster worker and shard agents",
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
export class ClusterOfflineModelProvider implements ModelProviderHandler {
  complete(request: ModelProviderRequest): Promise<ModelProviderResponse> {
    const answerTool =
      request.tools.find((t) => t.name.startsWith("answer-"))?.name ??
      "answer-chunk-draft-dto";
    const userMessage =
      request.messages.find((m) => m.role === "user")?.text ?? "";

    if (answerTool.includes("decomposed")) {
      return Promise.resolve({
        text: "",
        toolCalls: [
          {
            id: "call_leaf_1",
            name: "answer-decomposed-leaf-dto",
            arguments: {
              report: "Leaf shard completed offline",
            },
          },
        ],
        usage: { inputTokens: 20, outputTokens: 10 },
        cost: usd(0.0001),
      });
    }

    const chunkMatch = /"chunkId"\s*:\s*"([^"]+)"/u.exec(userMessage);
    const chunkId = chunkMatch?.[1] ?? "chunk-1";

    return Promise.resolve({
      text: "",
      toolCalls: [
        {
          id: `call_${chunkId}`,
          name: answerTool,
          arguments: {
            chunkId,
            summary: `Processed ${chunkId}`,
          },
        },
      ],
      usage: { inputTokens: 20, outputTokens: 10 },
      cost: usd(0.0001),
    });
  }
}
