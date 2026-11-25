import { DatabaseStorage, SqliteDriver, defineEnv, env } from "@agboss/core";
import { hours } from "@agboss/core/units";

const databaseEnv = defineEnv({
  /** The SQLite file (`:memory:` for the demo and the tests). */
  path: env("SQLITE_PATH", { default: ":memory:" }),
});

/** The application's rows: the ledger of its budgets, the records, the pauses, the checkpoints and the leases. */
@DatabaseStorage({
  name: "credit-review-database-storage",
  driver: SqliteDriver({ path: databaseEnv.path }),
  auditLogTtl: hours(24),
  ledgerEntriesTtl: hours(24),
})
export class CreditReviewDatabaseStorage {}
