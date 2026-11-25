import { Clock, type TokenUsage } from "@agboss/core";
import {
  ModelCost,
  ModelProvider,
  CircuitBreakerPolicy,
  PromptCaching,
  Reasoning,
  type ModelProviderHandler,
  type ModelProviderRequest,
  type ModelProviderResponse,
  type ModelProviderStream,
} from "@agboss/core/models";
import { minutes, seconds, usd } from "@agboss/core/units";

/** `sku,qty,unit_usd` rows of an invoice CSV (the header row has no number to match). */
const ROW = /^[^,\n]+,(\d+),(\d+(?:\.\d+)?)\s*$/gmu;

/** The reviewer's answer, worked out of the invoice CSV the model was shown: the stand-in's "model". */
function reviewOf(text: string): string {
  const id = /INV-\d+/u.exec(text)?.[0] ?? "the invoice";
  const rows = [...text.matchAll(ROW)];
  const total = rows.reduce((sum, row) => sum + Number(row[1]) * Number(row[2]), 0);
  return `${id} has ${String(rows.length)} line items totalling ${total.toFixed(2)} USD, so the SLA credit can be checked against that total.`;
}

/** What the stand-in answers: an audit question PASSes, anything else is the invoice review. */
function answerOf(request: ModelProviderRequest): string {
  const text = request.messages.map((message) => message.text).join("\n");
  return text.includes("AUDIT RUBRIC") ? "PASS (internal audit note: item count and total present)" : reviewOf(text);
}

function usageOf(request: ModelProviderRequest, answer: string): TokenUsage {
  const sent = request.messages.reduce((sum, message) => sum + message.text.length, 0);
  return {
    inputTokens: Math.ceil(sent / 4),
    outputTokens: Math.ceil(answer.length / 4),
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
}

/**
 * An offline stand-in for the billing desk's model, so the example runs without a key: a transport
 * provider that reads the invoice CSV the framework put into the model's messages, works out the
 * item count and total, and answers word by word with a pause between words, as a model that streams
 * does. `billing.live.app.ts` swaps it for OpenRouter.
 */
@ModelProvider({
  name: "invoice-reviewer-offline-model-provider",
  description: "Offline stand-in for the invoice reviewer's model; streams its answer word by word",
  timeout: seconds(30),
  cost: ModelCost.fromPrices({
    "openai/gpt-4o-mini": { inputPerMillion: usd(0.15), outputPerMillion: usd(0.6) },
    "google/gemini-2.5-flash-lite": { inputPerMillion: usd(0.1), outputPerMillion: usd(0.4) },
  }),
  reasoning: Reasoning.off(),
  promptCaching: PromptCaching.off(),
  circuitBreakerPolicy: CircuitBreakerPolicy.fixed({
    failureThreshold: 5,
    failureWindow: minutes(1),
    openDuration: seconds(10),
  }),
  deps: [Clock],
})
export class InvoiceReviewerOfflineModelProvider implements ModelProviderHandler {
  constructor(private readonly clock: Clock) {}

  complete(request: ModelProviderRequest): Promise<ModelProviderResponse> {
    const text = answerOf(request);
    return Promise.resolve({ text, usage: usageOf(request, text) });
  }

  stream(request: ModelProviderRequest): ModelProviderStream {
    const answer = answerOf(request);
    const clock = this.clock;
    const words = answer.split(/(?<= )/u);
    const textStream = async function* (): AsyncGenerator<string> {
      for (const word of words) {
        await clock.sleep(seconds(0.03));
        yield word;
      }
    };
    return { textStream: textStream(), result: Promise.resolve({ usage: usageOf(request, answer) }) };
  }
}
