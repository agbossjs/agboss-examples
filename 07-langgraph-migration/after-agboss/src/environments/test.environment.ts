import { env, secret } from "agboss";
import type { AppEnvironment } from "./app.environment.js";

export const environment: AppEnvironment = {
  sqlitePath: env("SQLITE_PATH", { default: ":memory:" }),
  openRouterApiKey: secret("OPENROUTER_API_KEY"),
};
