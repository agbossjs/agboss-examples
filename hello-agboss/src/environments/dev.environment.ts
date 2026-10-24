import { env } from "agboss";
import type { AppEnvironment } from "./app.environment.js";

export const environment: AppEnvironment = {
  catalogCurrency: env("CATALOG_CURRENCY", { default: "USD" }),
};
