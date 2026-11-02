import { secret } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

export const environment: AppEnvironment = {
  sqlitePath: ":memory:",
  httpPort: 0,
  metricsPort: 0,
  openRouterApiKey: secret("SCALING_UNUSED_MODEL_KEY"),
};
