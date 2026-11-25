import { DatabaseStorage, SqliteDriver, defineEnv, env, secret } from "@agboss/core";
import { hours } from "@agboss/core/units";

const databaseEnv = defineEnv({
  /** The SQLite file (`:memory:` for the demo and the tests). */
  path: env("SQLITE_PATH", { default: ":memory:" }),
  /** The application's own PII key (#825): one token per value on every instance, never the provider's key. */
  piiSecret: secret("PII_PSEUDONYM_KEY"),
});

/** Where the hello applications' rows go: the ledger of their budgets, the records, the leases. */
@DatabaseStorage({
  name: "hello-database-storage",
  driver: SqliteDriver({ path: databaseEnv.path }),
  auditLogTtl: hours(24),
  ledgerEntriesTtl: hours(24),
  piiSecret: databaseEnv.piiSecret,
})
export class HelloDatabaseStorage {}
