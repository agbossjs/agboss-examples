import {
  CachedPart,
  CacheRetention,
  EnvironmentVariable,
  ModelCost,
  ModelFailure,
  ModelProvider,
  OpenRouterProvider,
  PromptCaching,
  Reasoning,
  RetryPolicy,
  type OpenRouterFields,
} from "graphcompose/models";
import { minutes, seconds } from "graphcompose/units";

/**
 * job-scout's chat models: OpenRouter, which returns each call's cost. Jev decides through the
 * framework's `JevModelProvider` (it serves `typesafe/jev-*` for decisions only).
 */
@ModelProvider({
  name: "openrouter",
  description: "OpenRouter — many models behind one OpenAI-compatible API",
  serves: [/.*/],
  baseUrl: EnvironmentVariable.named("OPENROUTER_BASE_URL", {
    secret: false,
    defaultValue: "https://openrouter.ai/api/v1",
  }),
  apiKey: EnvironmentVariable.named("OPENROUTER_API_KEY", { secret: true }),
  timeout: minutes(2),
  cost: ModelCost.fromResponse(),
  reasoning: Reasoning.modelDecides(),
  promptCaching: PromptCaching.whereSupported({
    retention: CacheRetention.FiveMinutes,
    cachedParts: [CachedPart.SystemPrompt, CachedPart.Tools, CachedPart.History],
  }),
  retryPolicy: RetryPolicy.exponential({
    maxAttempts: 3,
    initialDelay: seconds(1),
    maxDelay: seconds(20),
    jitter: true,
    retryOn: [ModelFailure.Timeout, ModelFailure.RateLimited, ModelFailure.ServerError],
  }),
  circuitBreakerPolicy: { failureThreshold: 5, window: minutes(1), openFor: seconds(30) },
})
export class OpenRouterModelProvider extends OpenRouterProvider {
  // kimi-k2.6 via Inceptron loops while generating tool-call arguments (seen in #92, #97)
  override readonly requestFields: OpenRouterFields = { provider: { ignore: ["Inceptron"] } };
}
