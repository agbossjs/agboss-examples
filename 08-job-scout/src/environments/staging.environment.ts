import { env } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

/** `--env staging`: the board API from the deployment (GREENHOUSE_API_URL, OPENROUTER_API_KEY, PII_PSEUDONYM_KEY and AGBOSS_SQLITE_PATH must be set). */
export const environment: AppEnvironment = {
  greenhouseApiUrl: env("GREENHOUSE_API_URL"),
};
