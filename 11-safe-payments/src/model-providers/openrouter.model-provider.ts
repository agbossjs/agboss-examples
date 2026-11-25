import { env, secret } from "@agboss/core";
import { ModelCost, ModelProvider, OpenRouterDriver } from "@agboss/core/models";
import { minutes } from "@agboss/core/units";

/**
 * Where the agents' chat model would come from: OpenRouter. This example never calls it — every model turn of
 * PS7, PS11 and PS21 is scripted (`mockLlm`), offline and $0; it is here because an agent's model needs a
 * provider. Its key is read only when a model is called, so nothing is set anywhere.
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
