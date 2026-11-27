import { configureEnv, defineConfig } from "@agboss/core";
import { helloEnv } from "../hello-agboss.env.js";

/** What the tests run on: the pricing address stays the default, whatever the process sets. */
export default defineConfig({
  env: configureEnv(helloEnv, {
    catalogCurrency: "USD",
    pricingApiBaseUrl: "https://pricing.internal.example",
  }),
});
