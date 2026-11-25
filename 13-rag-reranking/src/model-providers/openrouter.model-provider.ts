import { env, secret } from "@agboss/core";
import { ModelCost, ModelProvider, OpenRouterDriver } from "@agboss/core/models";
import { minutes } from "@agboss/core/units";

/**
 * The handbook agents' models and the LLM reranker's: OpenRouter. The key and the base URL are references
 * read once when the application starts; the offline demo points `OPENROUTER_BASE_URL` at its scripted
 * stand-in on 127.0.0.1 (agbossjs/agboss#834), the tests script every model.
 */
@ModelProvider({
  name: "openrouter-model-provider",
  description: "OpenRouter — many models behind one OpenAI-compatible API",
  driver: OpenRouterDriver({
    apiKey: secret("OPENROUTER_API_KEY"),
    baseUrl: env("OPENROUTER_BASE_URL", { default: "https://openrouter.ai/api/v1" }),
  }),
  timeout: minutes(2),
  cost: ModelCost.fromResponse(),
})
export class OpenRouterModelProvider {}
