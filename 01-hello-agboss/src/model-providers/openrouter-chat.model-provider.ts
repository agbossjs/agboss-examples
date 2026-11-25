import { env, secret } from "@agboss/core";
import {
  CachedPart,
  CacheRetention,
  CircuitBreakerPolicy,
  ModelCost,
  ModelProvider,
  OpenRouterDriver,
  PromptCaching,
  Reasoning,
  RetryPolicy,
  TRANSIENT_FAILURES,
} from "@agboss/core/models";
import { minutes, seconds } from "@agboss/core/units";

/**
 * Every chat model of the hello application, on OpenRouter: a driver provider, so its class is
 * empty. The key and the base URL are references read once when the application starts; the offline
 * demo points `OPENROUTER_BASE_URL` at its scripted stand-in (agbossjs/agboss#834).
 */
@ModelProvider({
  name: "openrouter-chat-model-provider",
  description:
    "OpenRouter — multi-model gateway with prompt caching, retry policy, and circuit breaker",
  driver: OpenRouterDriver({
    apiKey: secret("OPENROUTER_API_KEY"),
    baseUrl: env("OPENROUTER_BASE_URL", { default: "https://openrouter.ai/api/v1" }),
  }),
  timeout: minutes(2),
  cost: ModelCost.fromResponse(),
  reasoning: Reasoning.modelDecides(),
  promptCaching: PromptCaching.on({
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
  circuitBreakerPolicy: CircuitBreakerPolicy.fixed({
    failureThreshold: 5,
    failureWindow: minutes(1),
    openDuration: seconds(30),
  }),
})
export class OpenRouterChatModelProvider {}
