import { env } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

/** The one SQLite file of the shop (`:memory:` by default; the tests and the two processes of PS2 / PS5 give a file they share). */
export const environment: AppEnvironment = {
  sqlitePath: env("SQLITE_PATH", { default: ":memory:" }),
};
