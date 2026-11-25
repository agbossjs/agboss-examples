import { env, secret } from "@agboss/core";
import { ModelCost, ModelProvider, OpenRouterDriver } from "@agboss/core/models";
import { minutes } from "@agboss/core/units";

/**
 * Where the agents' chat model comes from: OpenRouter. Its key is read when a model is called, so a run
 * that never calls one (the tests script the models; the demo serves a stand-in on 127.0.0.1 through
 * `OPENROUTER_BASE_URL`) needs none; `npm run demo:live` sets `OPENROUTER_API_KEY`.
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
