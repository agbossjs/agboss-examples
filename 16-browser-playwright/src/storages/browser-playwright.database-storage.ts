import { DatabaseStorage, SqliteDriver, defineEnv, env, secret } from "@agboss/core";
import { hours } from "@agboss/core/units";

const databaseEnv = defineEnv({
  /** The SQLite file (`:memory:` by default; the crash tests give a file the two instances share). */
  path: env("SQLITE_PATH", { default: ":memory:" }),
  /** The HMAC key of the business-key fingerprints of `Idempotency` (`contact:<reference>`): a Secret of its own, never the PII key. */
  idempotencySecret: secret("IDEMPOTENCY_KEY"),
  /** One PII key for every instance and process: the same token for one value everywhere. */
  piiSecret: secret("PII_PSEUDONYM_KEY"),
});

/** The application's rows: the cost ledger, the records, the pauses, the checkpoints, the leases and the intents of the contact form's outbound call, on one SQLite file. */
@DatabaseStorage({
  name: "browser-playwright-database-storage",
  driver: SqliteDriver({ path: databaseEnv.path }),
  auditLogTtl: hours(24),
  ledgerEntriesTtl: hours(24),
  idempotencySecret: databaseEnv.idempotencySecret,
  piiSecret: databaseEnv.piiSecret,
})
export class BrowserPlaywrightDatabaseStorage {}
