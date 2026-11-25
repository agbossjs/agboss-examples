import { env, secret } from "@agboss/core";
import { ModelCost, ModelProvider, OpenRouterDriver } from "@agboss/core/models";
import { minutes } from "@agboss/core/units";

/**
 * The real OpenRouter, listed only for `npm run demo:files:live` (`RECEIPT_LIVE`): the receipt readers
 * and their redaction model name it then. The key is read when the application starts, and only a
 * provider a model resolves to is connected: the offline run never reads it.
 */
@ModelProvider({
  name: "openrouter-model-provider",
  description: "OpenRouter — the live receipt run's models",
  driver: OpenRouterDriver({
    apiKey: secret("OPENROUTER_API_KEY"),
    baseUrl: env("OPENROUTER_BASE_URL", { default: "https://openrouter.ai/api/v1" }),
  }),
  timeout: minutes(2),
  cost: ModelCost.fromResponse(),
})
export class OpenRouterModelProvider {}
