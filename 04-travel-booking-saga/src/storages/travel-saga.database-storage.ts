import { DatabaseStorage, SqliteDriver, defineEnv, env, secret } from "@agboss/core";
import { hours } from "@agboss/core/units";

// Offline default: the demos, the tests and `agboss check` need no setup; a deployment sets the variable.
process.env.PII_PSEUDONYM_KEY ??= "travel-booking-saga-offline-pseudonym-key";

const databaseEnv = defineEnv({
  /** The SQLite file (`:memory:` for the demo and the tests). */
  path: env("SQLITE_PATH", { default: ":memory:" }),
  /** The application's PII key: one token per value on every instance. */
  piiSecret: secret("PII_PSEUDONYM_KEY"),
});

/** Where the saga's rows go: the budgets' ledger, the records, the pauses, the checkpoints and the leases. */
@DatabaseStorage({
  name: "travel-saga-database-storage",
  driver: SqliteDriver({ path: databaseEnv.path }),
  auditLogTtl: hours(24),
  ledgerEntriesTtl: hours(24),
  piiSecret: databaseEnv.piiSecret,
})
export class TravelSagaDatabaseStorage {}
