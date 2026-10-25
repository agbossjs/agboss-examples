import {
  ModelCost,
  ModelProvider,
  ModelProviderMessageRole,
  RetryPolicy,
  TRANSIENT_FAILURES,
  type ModelProviderHandler,
  type ModelProviderRequest,
  type ModelProviderResponse,
} from "agboss/models";
import { minutes, seconds, usd } from "agboss/units";

/**
 * Offline deterministic transport `@ModelProvider` so `npm run demo` runs out-of-the-box
 * with zero network calls or API keys while exercising the full AGBoss gateway, router,
 * tool-call loop, and answer-tool validation pipeline.
 */
@ModelProvider({
  name: "offline-demo-model-provider",
  description: "Deterministic local transport model provider for offline verification and demo runs",
  serves: [/.*/],
  timeout: seconds(30),
  cost: ModelCost.fromPrices({
    "moonshotai/kimi-k2.6": { inputPerMillion: usd(0.1), outputPerMillion: usd(0.2) },
    "openai/gpt-4o-mini": { inputPerMillion: usd(0.15), outputPerMillion: usd(0.6) },
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
export class OfflineDemoModelProvider implements ModelProviderHandler {
  complete(request: ModelProviderRequest): Promise<ModelProviderResponse> {
    const userOnlyText = request.messages
      .filter((m) => m.role === ModelProviderMessageRole.User)
      .map((m) => m.text)
      .join("\n");

    // 1. Router call (no tools bound)
    if (request.tools.length === 0) {
      const isPricing = /"question"\s*:\s*"[^"]*(?:pricing|price|quote)/i.test(userOnlyText);
      const next = isPricing ? "quote-advisor-agent" : "support-specialist-agent";
      return Promise.resolve({
        text: JSON.stringify({
          next,
          reason: isPricing ? "Customer requested pricing quote" : "General product inquiry",
        }),
        usage: { inputTokens: 48, outputTokens: 16 },
      });
    }

    const calcTool = request.tools.find((t) => t.name === "calculate-quote-tool");
    const answerTool = request.tools.find((t) => t.name.startsWith("answer"));
    const toolResultMsg = [...request.messages]
      .reverse()
      .find((m) => m.role === ModelProviderMessageRole.Tool);

    // 2. First turn of QuoteAdvisorAgent: invoke calculate-quote-tool
    if (calcTool !== undefined && toolResultMsg === undefined) {
      const seatsMatch = /"seats"\s*:\s*(\d+)/.exec(userOnlyText);
      const seats = seatsMatch ? Number(seatsMatch[1]) : 12;
      const tier = /enterprise/i.test(userOnlyText)
        ? "enterprise"
        : /starter/i.test(userOnlyText)
          ? "starter"
          : "pro";

      return Promise.resolve({
        text: "",
        toolCalls: [
          {
            id: "call-quote-1",
            name: calcTool.name,
            arguments: { tier, seats },
          },
        ],
        usage: { inputTokens: 64, outputTokens: 24 },
      });
    }

    // 3. Second turn of QuoteAdvisorAgent: read tool output and call answer tool
    if (calcTool !== undefined && toolResultMsg !== undefined && answerTool !== undefined) {
      const parsedTool = JSON.parse(toolResultMsg.text) as {
        tier: string;
        seats: number;
        monthlyTotalUsd: number;
        volumeDiscountApplied: boolean;
        currency: string;
      };
      return Promise.resolve({
        text: "",
        toolCalls: [
          {
            id: "call-answer-quote",
            name: answerTool.name,
            arguments: {
              handledBy: "pricing",
              answer: `Quote for ${String(parsedTool.seats)} seats on ${parsedTool.tier} tier: $${String(parsedTool.monthlyTotalUsd)}/mo (${parsedTool.currency}, volume discount: ${String(parsedTool.volumeDiscountApplied)}).`,
              quotedMonthlyUsd: parsedTool.monthlyTotalUsd,
            },
          },
        ],
        usage: { inputTokens: 92, outputTokens: 36 },
      });
    }

    // 4. SupportSpecialistAgent: call answer tool directly
    if (answerTool !== undefined) {
      return Promise.resolve({
        text: "",
        toolCalls: [
          {
            id: "call-answer-support",
            name: answerTool.name,
            arguments: {
              handledBy: "support",
              answer:
                "AGBoss enforces compile-time and static Path Scope guarantees before any workflow executes.",
              quotedMonthlyUsd: 0,
            },
          },
        ],
        usage: { inputTokens: 52, outputTokens: 28 },
      });
    }

    return Promise.resolve({
      text: "Completed.",
      usage: { inputTokens: 10, outputTokens: 5 },
    });
  }
}
