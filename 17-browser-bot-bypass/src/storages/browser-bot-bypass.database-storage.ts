import { DatabaseStorage, SqliteDriver, defineEnv, env, secret } from "@agboss/core";
import { hours } from "@agboss/core/units";

const databaseEnv = defineEnv({
  /** The SQLite file of the cost ledger the tenant and application budgets count in (`:memory:` by default). */
  path: env("SQLITE_PATH", { default: ":memory:" }),
  /** One PII key for every instance and process: the same token for one value everywhere. */
  piiSecret: secret("PII_PSEUDONYM_KEY"),
});

/** The application's rows: the cost ledger, the records, the pauses, the checkpoints and the leases, on one SQLite file. */
@DatabaseStorage({
  name: "browser-bot-bypass-database-storage",
  driver: SqliteDriver({ path: databaseEnv.path }),
  auditLogTtl: hours(24),
  ledgerEntriesTtl: hours(24),
  piiSecret: databaseEnv.piiSecret,
})
export class BrowserBotBypassDatabaseStorage {}
