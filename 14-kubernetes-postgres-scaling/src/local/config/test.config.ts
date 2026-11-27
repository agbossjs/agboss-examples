import { configureEnv, defineConfig } from "@agboss/core";
import { scalingEnv } from "../../scaling.env.js";

/**
 * What the tests run on: no listening port. The rows are in `SQLITE_PATH` (`:memory:` by default; a test
 * of two instances gives them a file, `tests/support/instances-file.ts`); the tests start the stub on a
 * free port and set LEDGER_URL before the app is built.
 */
export default defineConfig({
  env: configureEnv(scalingEnv, { httpPort: 0, metricsPort: 0 }),
});
