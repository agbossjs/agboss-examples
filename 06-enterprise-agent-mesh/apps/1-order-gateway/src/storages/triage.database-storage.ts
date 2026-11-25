import { DatabaseStorage, SqliteDriver, defineEnv, env, secret } from "@agboss/core";
import { hours } from "@agboss/core/units";

const databaseEnv = defineEnv({
  /** The SQLite file (`:memory:` for the demo and the tests). */
  path: env("SQLITE_PATH", { default: ":memory:" }),
  /** The application's PII key: one token per value on every instance. */
  piiSecret: secret("PII_PSEUDONYM_KEY"),
  /** Keys the fingerprint of a business-keyed write: the A2A accept round trip is one (`Idempotency.sendOnce`). */
  idempotencySecret: secret("AGBOSS_IDEMPOTENCY_SECRET"),
});

/** The triage application's rows: the ledger of its budgets, the records, the pauses, the checkpoints, the leases, the A2A tasks and the mesh's kept answers. */
@DatabaseStorage({
  name: "triage-database-storage",
  driver: SqliteDriver({ path: databaseEnv.path }),
  auditLogTtl: hours(24),
  ledgerEntriesTtl: hours(24),
  piiSecret: databaseEnv.piiSecret,
  idempotencySecret: databaseEnv.idempotencySecret,
})
export class TriageDatabaseStorage {}
