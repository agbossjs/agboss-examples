import {
  Application,
  SqliteCheckpointSaver,
  SqliteChildExecutionQueueRepository,
  SqliteConnection,
  SqliteCostLedgerRepository,
  SqliteExecutionAuditLogRepository,
  SqliteExecutionHistoryRepository,
  SqliteExecutionLeaseRepository,
  SqliteExecutionRecordRepository,
  SqliteExecutionTreeRepository,
  SqlitePausedExecutionRepository,
  SqliteRateLimitRepository,
} from "@agboss/core";
import { RECOUNT_BUDGETS } from "../budgets/index.js";
import { RecountWorkflow } from "../workflows/recount/recount.workflow.js";
import { ShelfWorkflow } from "../workflows/shelf/shelf.workflow.js";
import { LocalEnvironment } from "./environments/app.environment.js";

/**
 * The same workflows on one machine (`npm test`, `npm run demo`, offline): the core's SQLite stores in
 * one file in place of MongoDB and Redis — the workflows' code is the one that runs on both.
 */
@Application({
  name: "local-mongo-redis-application",
  version: "1.0.0",
  environment: LocalEnvironment,
  workflows: [RecountWorkflow, ShelfWorkflow],
  budgets: RECOUNT_BUDGETS,
  maxConcurrentSteps: 4,
  providers: [
    SqliteConnection,
    SqliteCheckpointSaver,
    SqliteChildExecutionQueueRepository,
    SqliteCostLedgerRepository,
    SqliteExecutionAuditLogRepository,
    SqliteExecutionHistoryRepository,
    SqliteExecutionLeaseRepository,
    SqliteExecutionRecordRepository,
    SqliteExecutionTreeRepository,
    SqlitePausedExecutionRepository,
    SqliteRateLimitRepository,
  ],
})
export class LocalMongoRedisApplication {}
