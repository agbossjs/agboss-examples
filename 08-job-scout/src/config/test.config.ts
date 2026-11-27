import { configureEnv, defineConfig } from "@agboss/core";
import { jobScoutEnv } from "../job-scout.env.js";

/** What `testWith(JobScoutApplication)` runs on: a host no test reaches (fetches are stubbed or recorded); the rows are `:memory:` (vitest.config.ts). */
export default defineConfig({
  env: configureEnv(jobScoutEnv, { greenhouseApiUrl: "https://greenhouse.test" }),
});
