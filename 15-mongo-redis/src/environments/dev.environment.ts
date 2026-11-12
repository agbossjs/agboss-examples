import { env, secret } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

// an instance on your machine (`npm run demo:live`): MONGODB_URL and REDIS_URL from the environment;
// MONGODB_SCHEMA_SETUP=migrate-on-start migrates on start, else run `npx agboss-mongodb migrate` first
export const environment: AppEnvironment = {
  mongodbUrl: secret("MONGODB_URL"),
  mongodbDatabase: env.optional("MONGODB_DATABASE"),
  mongodbSchemaSetup: env.optional("MONGODB_SCHEMA_SETUP"),
  redisUrl: secret("REDIS_URL"),
  redisKeyPrefix: env.optional("REDIS_KEY_PREFIX"),
};
