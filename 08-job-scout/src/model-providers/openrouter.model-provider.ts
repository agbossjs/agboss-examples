import { env, secret } from "@agboss/core";
import { CachedPart, CacheRetention, CircuitBreakerPolicy, DecisionsDriver, ModelCost, ModelFailure, ModelProvider, OpenRouterDriver, PromptCaching, QueueBalancingStrategy, RateLimitPolicy, Reasoning, RetryPolicy } from "@agboss/core/models";
import { minutes, seconds } from "@agboss/core/units";

const breaker = CircuitBreakerPolicy.fixed({
  failureThreshold: 5,
  failureWindow: minutes(1),
  openDuration: seconds(30),
});

/**
 * job-scout's chat models: OpenRouter, which returns each call's cost — the application's `modelProvider`,
 * listed with `DecisionsModelProvider` (decision models: Jev, …; decisions only, no chat) in
 * `@Application({ providers })` (#266). Its key and base URL are references read once when the application
 * starts (`secret("OPENROUTER_API_KEY")`, `env("OPENROUTER_BASE_URL")`: a proxy or a stub); its rate limit is
 * OpenRouter's plan for the whole application — every instance shares it through the database storage.
 */
@ModelProvider({
  name: "openrouter-model-provider",
  description: "OpenRouter — many models behind one OpenAI-compatible API",
  driver: OpenRouterDriver({
    apiKey: secret("OPENROUTER_API_KEY"),
    baseUrl: env("OPENROUTER_BASE_URL", { default: "https://openrouter.ai/api/v1" }),
    // kimi-k2.6 via Inceptron loops while generating tool-call arguments (seen in #92, #97)
    routing: { ignore: ["Inceptron"] },
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
    retryOn: [ModelFailure.Timeout, ModelFailure.RateLimited, ModelFailure.ServerError],
  }),
  rateLimitPolicy: RateLimitPolicy.of({
    maxConcurrentCalls: 8,
    perMinute: { calls: 120 },
    balancing: QueueBalancingStrategy.TenantRoundRobin,
  }),
  circuitBreakerPolicy: breaker,
})
export class OpenRouterModelProvider {}

/** Jev, the decision model of the router and the guardrails, on OpenRouter's Decisions API. */
@ModelProvider({
  name: "decisions-model-provider",
  description: "Decision models on OpenRouter's Decisions API",
  driver: DecisionsDriver({
    apiKey: secret("OPENROUTER_API_KEY"),
    baseUrl: env("OPENROUTER_BASE_URL", { default: "https://openrouter.ai/api/v1" }),
  }),
  timeout: seconds(30),
  cost: ModelCost.fromResponse(),
  circuitBreakerPolicy: breaker,
})
export class DecisionsModelProvider {}
