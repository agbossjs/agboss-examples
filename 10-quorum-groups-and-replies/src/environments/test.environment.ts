import type { AppEnvironment } from "./app.environment.js";

/** What `testWith` runs on: models are scripted, so no key and no address. */
export const environment: AppEnvironment = { sqlitePath: ":memory:" };
