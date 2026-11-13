import { ModelCost, PromptCaching, Reasoning, RetryPolicy, TRANSIENT_FAILURES, RateLimitPolicy } from "@agboss/core/models";
import { minutes, seconds } from "@agboss/core/units";

/**
 * What every CLI provider declares: a plan is flat-priced (cost comes from the response, always $0),
 * one retry (a step costs a lot of plan tokens), one process at a time across instances, and no
 * `capabilities`, so the transport stays lazy and any ordinary `@Agent` can use it.
 */
export const CLI_PROVIDER_POLICY = {
  timeout: minutes(3),
  cost: ModelCost.fromResponse(),
  reasoning: Reasoning.modelDecides(),
  promptCaching: PromptCaching.off(),
  retryPolicy: RetryPolicy.exponential({
    maxAttempts: 2,
    initialDelay: seconds(2),
    maxDelay: seconds(20),
    jitter: true,
    retryOn: TRANSIENT_FAILURES,
  }),
  circuitBreakerPolicy: { failureThreshold: 5, window: minutes(1), openFor: seconds(30) },
  rateLimitPolicy: RateLimitPolicy.of({ maxConcurrentCalls: 1 }),
} as const;
