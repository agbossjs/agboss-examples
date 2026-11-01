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

/**
 * Where the agents' chat model would come from: OpenRouter. This example never calls it — every
 * model turn of PS7, PS11 and PS21 is scripted (`mockLlm`), offline and $0; it is here because an
 * agent's model needs a provider, and no key is set anywhere.
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
export class OpenRouterModelProvider extends OpenRouterProvider {
  override readonly requestFields: OpenRouterFields = {};
}
