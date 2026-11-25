import { env, secret } from "@agboss/core";
import {
  CircuitBreakerPolicy,
  DecisionsDriver,
  ModelCost,
  ModelProvider,
  OpenRouterDriver,
  PromptCaching,
  RateLimitPolicy,
  Reasoning,
  RetryPolicy,
  TRANSIENT_FAILURES,
} from "@agboss/core/models";
import { minutes, seconds } from "@agboss/core/units";

const breaker = CircuitBreakerPolicy.fixed({
  failureThreshold: 5,
  failureWindow: minutes(1),
  openDuration: seconds(30),
});

/**
 * Where the agents' chat models come from: OpenRouter, the application's `modelProvider`. The key and
 * the base URL are references read once when the application starts (`secret("OPENROUTER_API_KEY")`,
 * `env("OPENROUTER_BASE_URL")`); offline, `OPENROUTER_BASE_URL` points at the scripted wire served on 127.0.0.1.
 */
@ModelProvider({
  name: "openrouter-model-provider",
  description: "OpenRouter — many models behind one OpenAI-compatible API",
  driver: OpenRouterDriver({
    apiKey: secret("OPENROUTER_API_KEY"),
    baseUrl: env("OPENROUTER_BASE_URL", { default: "https://openrouter.ai/api/v1" }),
  }),
  timeout: minutes(2),
  // OpenRouter returns each call's cost
  cost: ModelCost.fromResponse(),
  reasoning: Reasoning.modelDecides(),
  // short prompts, one call per step: nothing worth caching
  promptCaching: PromptCaching.off(),
  retryPolicy: RetryPolicy.exponential({
    maxAttempts: 3,
    initialDelay: seconds(1),
    maxDelay: seconds(20),
    jitter: true,
    retryOn: TRANSIENT_FAILURES,
  }),
  rateLimitPolicy: RateLimitPolicy.of({ maxConcurrentCalls: 4 }),
  circuitBreakerPolicy: breaker,
})
export class OpenRouterModelProvider {}

/** Jev, the decision model of the model router, on OpenRouter's Decisions API (the same key and base URL). */
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
