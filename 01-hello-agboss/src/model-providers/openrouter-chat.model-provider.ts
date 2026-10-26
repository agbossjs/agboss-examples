import {
  CachedPart,
  CacheRetention,
  ModelCost,
  ModelProvider,
  OPENROUTER_BASE_URL,
  OpenRouterProvider,
  PromptCaching,
  Reasoning,
  RetryPolicy,
  TRANSIENT_FAILURES,
  type OpenRouterFields,
} from "@agboss/core/models";
import { minutes, seconds } from "@agboss/core/units";

@ModelProvider({
  name: "openrouter-chat-model-provider",
  description:
    "OpenRouter — multi-model gateway with prompt caching, retry policy, and circuit breaker",
  serves: [/^moonshotai\//u, /^openai\//u, /^anthropic\//u],
  baseUrl: OPENROUTER_BASE_URL,
  apiKey: "openRouterApiKey",
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
    retryOn: TRANSIENT_FAILURES,
  }),
  circuitBreakerPolicy: { failureThreshold: 5, window: minutes(1), openFor: seconds(30) },
})
export class OpenRouterChatModelProvider extends OpenRouterProvider {
  override readonly requestFields: OpenRouterFields = {};
}
