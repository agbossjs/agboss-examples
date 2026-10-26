import { env, secret } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

process.env.OPENROUTER_API_KEY ??=
  process.env.OPEN_ROUTER_KEY ?? "offline-test-openrouter-api-key";

export const environment: AppEnvironment = {
  openRouterApiKey: secret("OPENROUTER_API_KEY"),
  sqlitePath: env("SQLITE_PATH", { default: ":memory:" }),
};
