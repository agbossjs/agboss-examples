import { env, secret } from "@agboss/core";

// nothing here calls a model; the built-in provider still wants a key to be built (R6: synthetic)
process.env.SCALING_UNUSED_MODEL_KEY ??= "offline-no-model-is-ever-called";
import type { AppEnvironment } from "./app.environment.js";

export const environment: AppEnvironment = {
  sqlitePath: env("SQLITE_PATH", { default: ".agboss/scaling.sqlite" }),
  httpPort: env.integer("HTTP_PORT", { default: 8080 }),
  metricsPort: env.integer("METRICS_PORT", { default: 9464 }),
  openRouterApiKey: secret("SCALING_UNUSED_MODEL_KEY"),
};
