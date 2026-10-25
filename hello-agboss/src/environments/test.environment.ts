import { secret } from "agboss";
import type { AppEnvironment } from "./app.environment.js";

export const environment: AppEnvironment = {
  catalogCurrency: "USD",
  openRouterApiKey: secret("OPENROUTER_API_KEY"),
};
