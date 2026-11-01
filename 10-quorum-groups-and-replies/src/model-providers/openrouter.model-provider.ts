import {
  ModelCost,
  ModelProvider,
  OpenRouterProvider,
  PromptCaching,
  RateLimitPolicy,
  Reasoning,
  RetryPolicy,
  TRANSIENT_FAILURES,
  type OpenRouterFields,
} from "@agboss/core/models";
import { minutes, seconds } from "@agboss/core/units";

/** OpenRouter's request fields, and OpenAI's `parallel_tool_calls`, passed through as they are. */
interface PurchasingFields extends OpenRouterFields {
  readonly parallel_tool_calls?: boolean;
}

/**
 * Where the agents' chat models come from: OpenRouter (Jev, the decision model, through
 * `DecisionsModelProvider`) — both listed in `@Application({ providers })`, the same in every
 * environment. Both read their key from `openRouterApiKey` of the environment
 * (`secret("OPENROUTER_API_KEY")`). Offline, `createApp({ providerFetch })` scripts the wire.
 */
@ModelProvider({
  name: "openrouter-model-provider",
  description: "OpenRouter — many models behind one OpenAI-compatible API",
  serves: [/.*/],
  baseUrl: "https://openrouter.ai/api/v1",
  baseUrlField: "openRouterBaseUrl",
  apiKey: "openRouterApiKey",
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
  circuitBreakerPolicy: { failureThreshold: 5, window: minutes(1), openFor: seconds(30) },
})
export class OpenRouterModelProvider extends OpenRouterProvider<PurchasingFields> {
  // one tool call per model turn: a reviewer asked to cite "the clause" otherwise answers once per
  // clause, in parallel, and every answer is refused
  override readonly requestFields: PurchasingFields = { parallel_tool_calls: false };
}
