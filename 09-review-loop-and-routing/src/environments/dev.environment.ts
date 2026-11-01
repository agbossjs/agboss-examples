import { env, secret } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

/** `npm run demo` and `npm run demo:live`: the same providers; offline, the demo scripts the wire. */
export const environment: AppEnvironment = {
  sqlitePath: env("SQLITE_PATH", { default: ":memory:" }),
  openRouterApiKey: secret("OPENROUTER_API_KEY"),
  openRouterBaseUrl: env.optional("OPENROUTER_BASE_URL"),
};
