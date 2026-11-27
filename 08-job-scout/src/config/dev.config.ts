import { configureEnv, defineConfig } from "@agboss/core";
import { jobScoutEnv, PUBLIC_GREENHOUSE_API_URL } from "../job-scout.env.js";

/** `npm run chat` (the default profile): the public Greenhouse API; records in `.agboss/job-scout.sqlite` (git-ignored) unless AGBOSS_SQLITE_PATH says otherwise. */
export default defineConfig({
  env: configureEnv(jobScoutEnv, { greenhouseApiUrl: PUBLIC_GREENHOUSE_API_URL }),
});
