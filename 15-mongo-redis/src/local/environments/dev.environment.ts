import { env } from "@agboss/core";
import type { LocalEnvironment } from "./app.environment.js";

export const environment: LocalEnvironment = {
  sqlitePath: env("SQLITE_PATH", { default: ".agboss/recount.sqlite" }),
};
