import { secret } from "@agboss/core";
import type { AppEnvironment } from "../../../../src/environments/app.environment.js";

// the variants are only assembled — never started — so the URLs are placeholders the test sets
export const environment: AppEnvironment = {
  mongodbUrl: secret("MONGODB_URL"),
  redisUrl: secret("REDIS_URL"),
};
