import { env, secret } from "agboss";
import type { AppEnvironment } from "./app.environment.js";

export const environment: AppEnvironment = {
  catalogCurrency: env("CATALOG_CURRENCY", { default: "USD" }),
  openRouterApiKey: secret("OPENROUTER_API_KEY"),
};
