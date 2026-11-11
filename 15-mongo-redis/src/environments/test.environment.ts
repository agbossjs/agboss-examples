import { env, secret } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

// the offline tests assemble this application without connecting (tests/stores/) and run the
// workflows on LocalMongoRedisApplication; tests/live/ runs it on MONGODB_URL and REDIS_URL when set
export const environment: AppEnvironment = {
  mongodbUrl: secret("MONGODB_URL"),
  mongodbDatabase: env.optional("MONGODB_DATABASE"),
  mongodbSchemaSetup: "migrate-on-start",
  redisUrl: secret("REDIS_URL"),
};
