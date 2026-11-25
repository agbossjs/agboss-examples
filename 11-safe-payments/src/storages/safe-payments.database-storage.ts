import { DatabaseStorage, SqliteDriver, defineEnv, env, secret } from "@agboss/core";
import { hours } from "@agboss/core/units";

const databaseEnv = defineEnv({
  /** The SQLite file: `:memory:` by default; the tests and the two processes of PS2 / PS5 give one file they share. */
  path: env("SQLITE_PATH", { default: ":memory:" }),
  /** The HMAC key of the business-key fingerprints (`order:<id>`, `refund:<charge>:<n>`): a Secret of its own, never the PII key. */
  idempotencySecret: secret("IDEMPOTENCY_KEY"),
  /** One pseudonym key on every instance (A8). */
  piiSecret: secret("PII_PSEUDONYM_KEY"),
});

/** The shop's rows, every store on one file every instance (and every process of PS2 / PS5) shares: the budgets' ledger, the records, the pauses, the checkpoints, the leases, the intents of every money-moving call and the fenced effects. */
@DatabaseStorage({
  name: "safe-payments-database-storage",
  driver: SqliteDriver({ path: databaseEnv.path }),
  auditLogTtl: hours(24),
  ledgerEntriesTtl: hours(24),
  idempotencySecret: databaseEnv.idempotencySecret,
  piiSecret: databaseEnv.piiSecret,
})
export class SafePaymentsDatabaseStorage {}
