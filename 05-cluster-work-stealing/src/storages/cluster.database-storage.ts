import { DatabaseStorage, SqliteDriver, defineEnv, env, secret } from "@agboss/core";
import { hours } from "@agboss/core/units";

// Offline defaults, so `agboss check`, the demos and the scenarios need no setup; a deployment sets both variables.
process.env.PII_PSEUDONYM_KEY ??= "cluster-work-stealing-pseudonym-key-32b!!";
process.env.IDEMPOTENCY_KEY ??= "cluster-work-stealing-offline-idempotency-key";

const databaseEnv = defineEnv({
  /** The SQLite file (`:memory:` for the demo and the tests). */
  path: env("SQLITE_PATH", { default: ":memory:" }),
  /** The HMAC key of the business-key fingerprints of `Idempotency`. */
  idempotencySecret: secret("IDEMPOTENCY_KEY"),
  /** The application's PII key: one token per value on every instance. */
  piiSecret: secret("PII_PSEUDONYM_KEY"),
});

/** The cluster's one SQLite file (`SQLITE_PATH`, shared by every instance): the ledger of its budgets, the records, the pauses, the checkpoints, the leases, the child queue and the fenced effects. `:memory:` in a single-instance run. */
@DatabaseStorage({
  name: "cluster-database-storage",
  driver: SqliteDriver({ path: databaseEnv.path }),
  auditLogTtl: hours(24),
  ledgerEntriesTtl: hours(24),
  idempotencySecret: databaseEnv.idempotencySecret,
  piiSecret: databaseEnv.piiSecret,
})
export class ClusterDatabaseStorage {}
