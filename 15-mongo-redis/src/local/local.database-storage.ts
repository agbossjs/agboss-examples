import { DatabaseStorage, SqliteDriver, defineEnv, env, secret } from "@agboss/core";
import { hours } from "@agboss/core/units";

const databaseEnv = defineEnv({
  /** The stores' SQLite file (`:memory:` in tests). */
  path: env("SQLITE_PATH", { default: ".agboss/recount.sqlite" }),
  /** The application's own PII key: one token per value on every instance. */
  piiSecret: secret("PII_PSEUDONYM_KEY"),
});

/** The local twin's rows: one SQLite file in place of MongoDB and Redis. */
@DatabaseStorage({
  name: "local-database-storage",
  driver: SqliteDriver({ path: databaseEnv.path }),
  auditLogTtl: hours(24),
  ledgerEntriesTtl: hours(24),
  piiSecret: databaseEnv.piiSecret,
})
export class LocalDatabaseStorage {}
