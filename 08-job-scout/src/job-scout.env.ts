import { defineEnv, env } from "@agboss/core";

/**
 * job-scout's own process variables (#261, #1324): references, never values. The values of a
 * deployment are the profiles in `src/config/<name>.config.ts`: `dev` and `prod` point at the
 * public board API, `test` at a host no test reaches, and `staging` sets nothing, so the variable
 * itself must be set. Read as `deps: [jobScoutEnv]` (`GreenhouseBoards`). The model providers'
 * keys and base URL and the storage's file and PII key are not here: each reads its own
 * reference (`secret(…)`, `env(…)`) when the application starts.
 */
export const jobScoutEnv = defineEnv({
  /** The Greenhouse job-board API. */
  greenhouseApiUrl: env("GREENHOUSE_API_URL"),
});

/** The public Greenhouse board API: what `dev` and `prod` run on. */
export const PUBLIC_GREENHOUSE_API_URL = "https://boards-api.greenhouse.io";
