import { configureEnv, defineConfig } from "@agboss/core";
import { jobScoutEnv, PUBLIC_GREENHOUSE_API_URL } from "../job-scout.env.js";

/** `--profile prod`: the public board API; the deployment sets OPENROUTER_API_KEY, PII_PSEUDONYM_KEY and AGBOSS_SQLITE_PATH (the records file); `agboss check --profile prod` lists the process variables, never a value. */
export default defineConfig({
  env: configureEnv(jobScoutEnv, { greenhouseApiUrl: PUBLIC_GREENHOUSE_API_URL }),
});
