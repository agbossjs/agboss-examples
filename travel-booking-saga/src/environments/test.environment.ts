import { env } from "agboss";
import type { AppEnvironment } from "./app.environment.js";

export const environment: AppEnvironment = {
  sqlitePath: env("SQLITE_PATH", { default: ":memory:" }),
};
