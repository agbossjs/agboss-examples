import { DatabaseStorage, SqliteDriver, defineEnv, env, secret } from "@agboss/core";
import { hours } from "@agboss/core/units";

/** The local storage's references: the SQLite file and the two keys both local instances share. */
export const localDatabaseEnv = defineEnv({
  /** The stores' SQLite file (`:memory:` in tests). */
  path: env("SQLITE_PATH", { default: ".agboss/scaling.sqlite" }),
  /** The idempotency key: business-key fingerprints only — never the PII key. */
  idempotencySecret: secret("IDEMPOTENCY_KEY"),
  /** The PII key both local instances share. */
  piiSecret: secret("PII_PSEUDONYM_KEY"),
});

/** The same stores on one machine (`npm test`, `npm run demo`, offline, R4): the SQLite stores in one file instead of PostgreSQL. */
@DatabaseStorage({
  name: "local-database-storage",
  driver: SqliteDriver({ path: localDatabaseEnv.path }),
  auditLogTtl: hours(24),
  ledgerEntriesTtl: hours(24),
  idempotencySecret: localDatabaseEnv.idempotencySecret,
  piiSecret: localDatabaseEnv.piiSecret,
})
export class LocalDatabaseStorage {}
