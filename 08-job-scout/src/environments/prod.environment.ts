import type { AppEnvironment } from "./app.environment.js";

/**
 * `--env prod`: the public board API; the deployment sets OPENROUTER_API_KEY, PII_PSEUDONYM_KEY and
 * AGBOSS_SQLITE_PATH (the records file); `agboss check --env prod` lists the process variables, never a value.
 */
export const environment: AppEnvironment = {
  greenhouseApiUrl: "https://boards-api.greenhouse.io",
};
