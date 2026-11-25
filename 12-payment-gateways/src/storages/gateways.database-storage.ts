import { DatabaseStorage, SqliteDriver, defineEnv, env, secret } from "@agboss/core";
import { hours } from "@agboss/core/units";

const databaseEnv = defineEnv({
  /** The SQLite file (`:memory:` by default; the tests give each test its own file, two instances share it). */
  path: env("SQLITE_PATH", { default: ":memory:" }),
  /** The HMAC key of the business-key fingerprints of `Idempotency` (`order:<id>`, `refund:<payment>:<n>`): a Secret of its own, never the PII key. */
  idempotencySecret: secret("IDEMPOTENCY_KEY"),
  /** One pseudonym key on every instance (A8). */
  piiSecret: secret("PII_PSEUDONYM_KEY"),
});

/** The shop's rows: the ledger of its budgets, the records, the checkpoints, the leases, the intents of the outbound calls and the fenced effects, on one SQLite file. */
@DatabaseStorage({
  name: "gateways-database-storage",
  driver: SqliteDriver({ path: databaseEnv.path }),
  auditLogTtl: hours(24),
  ledgerEntriesTtl: hours(24),
  idempotencySecret: databaseEnv.idempotencySecret,
  piiSecret: databaseEnv.piiSecret,
})
export class GatewaysDatabaseStorage {}
