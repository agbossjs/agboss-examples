import { env } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

/** `testWith`: the Cohere SDK against the stub each test file starts (`COHERE_BASE_URL`). */
export const environment: AppEnvironment = {
  cohereBaseUrl: env("COHERE_BASE_URL", { default: "http://127.0.0.1:4791" }),
};
