import { DatabaseStorage, SqliteDriver, defineEnv, env, secret } from "@agboss/core";
import { hours } from "@agboss/core/units";

process.env.PII_PSEUDONYM_KEY ??= "job-scout-offline-pseudonym-key";

const databaseEnv = defineEnv({
  /** The SQLite file (`:memory:` in the tests: vitest.config.ts). */
  path: env("AGBOSS_SQLITE_PATH", { default: ".agboss/job-scout.sqlite" }),
  /** The application's PII key: one token per value on every instance. */
  piiSecret: secret("PII_PSEUDONYM_KEY"),
});

/** The application's rows: the ledger of its budgets, the records, the pauses, the checkpoints and the leases. */
@DatabaseStorage({
  name: "job-scout-database-storage",
  driver: SqliteDriver({ path: databaseEnv.path }),
  auditLogTtl: hours(24),
  ledgerEntriesTtl: hours(24),
  piiSecret: databaseEnv.piiSecret,
})
export class JobScoutDatabaseStorage {}
