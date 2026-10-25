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
  name: "triage-offline-model-provider",
  description: "Deterministic offline model provider driving TriageAgent tool calls",
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
export class TriageOfflineModelProvider implements ModelProviderHandler {
  complete(request: ModelProviderRequest): Promise<ModelProviderResponse> {
    const answerTool =
      request.tools.find((t) => t.name.startsWith("answer-"))?.name ??
      "answer-triage-response-dto";
    const toolMessages = request.messages.filter((m) => m.role === "tool");

    if (toolMessages.length === 0) {
      return Promise.resolve({
        text: "",
        toolCalls: [
          {
            id: "call_catalog_1",
            name: "search-catalog-tool",
            arguments: { sku: "SKU-GPU-900" },
          },
        ],
        usage: { inputTokens: 30, outputTokens: 12 },
        cost: usd(0.0001),
      });
    }

    if (toolMessages.length === 1) {
      return Promise.resolve({
        text: "",
        toolCalls: [
          {
            id: "call_billing_1",
            name: "ask-billing-tool",
            arguments: {
              invoiceId: "INV-5001",
              question: "Verify SLA credit for delayed GPU rack delivery",
            },
          },
        ],
        usage: { inputTokens: 40, outputTokens: 15 },
        cost: usd(0.0001),
      });
    }

    return Promise.resolve({
      text: "",
      toolCalls: [
        {
          id: "call_triage_answer",
          name: answerTool,
          arguments: {
            invoiceId: "INV-5001",
            sku: "SKU-GPU-900",
            summary:
              "SKU-GPU-900 verified in catalog (14 units) and invoice INV-5001 credited $45.00 by billing-application.",
            creditedUsd: 45,
          },
        },
      ],
      usage: { inputTokens: 50, outputTokens: 20 },
      cost: usd(0.0001),
    });
  }
}
