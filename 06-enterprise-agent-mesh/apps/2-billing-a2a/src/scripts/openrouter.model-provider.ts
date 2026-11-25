import { env, secret } from "@agboss/core";
import { ModelCost, ModelProvider, OpenRouterDriver } from "@agboss/core/models";
import { minutes } from "@agboss/core/units";

/** The billing agent's real models, for the live demo only (`billing.live.app.ts`): the key is read when it starts. */
@ModelProvider({
  name: "openrouter-model-provider",
  description: "OpenRouter — the live invoice reviewer's models",
  driver: OpenRouterDriver({
    apiKey: secret("OPENROUTER_API_KEY"),
    baseUrl: env("OPENROUTER_BASE_URL", { default: "https://openrouter.ai/api/v1" }),
  }),
  timeout: minutes(2),
  cost: ModelCost.fromResponse(),
})
export class OpenRouterModelProvider {}
