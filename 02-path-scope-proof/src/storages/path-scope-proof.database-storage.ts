import { DatabaseStorage, SqliteDriver, defineEnv, env } from "@agboss/core";
import { hours } from "@agboss/core/units";

const databaseEnv = defineEnv({
  /** The SQLite file (`:memory:` for the demo and the tests). */
  path: env("SQLITE_PATH", { default: ":memory:" }),
});

/** Where the proofs' rows go: the ledger of the suite budgets, in memory (:memory:). */
@DatabaseStorage({
  name: "path-scope-proof-database-storage",
  driver: SqliteDriver({ path: databaseEnv.path }),
  auditLogTtl: hours(24),
  ledgerEntriesTtl: hours(24),
})
export class PathScopeProofDatabaseStorage {}
