import { Application } from "@agboss/core";
import { RECOUNT_BUDGETS } from "./budgets/index.js";
import { RecountClusterStorage } from "./storages/recount.cluster-storage.js";
import { RecountDatabaseStorage } from "./storages/recount.database-storage.js";
import { RecountWorkflow } from "./workflows/recount/recount.workflow.js";
import { ShelfWorkflow } from "./workflows/shelf/shelf.workflow.js";

/**
 * The recount on MongoDB + Redis (agbossjs/agboss#891): Redis coordinates — the leases, the child
 * queue, the rate limits (`RecountClusterStorage`, `RedisDriver`) — and MongoDB keeps everything
 * durable (`RecountDatabaseStorage`, `MongoDriver`): records, checkpoints, pauses, trees, history,
 * budgets, mesh requests, the audit log, A2A tasks. The Redis lease store keeps no execution ids of
 * its own: the container binds the database driver's lease store under `EXECUTION_ID_STORE` for it
 * (no `new`, and no second lease store). Fenced effects and outbound calls need their lease check in
 * one transaction with the leases, which Redis cannot give, so none is provided: an effect that must
 * happen once runs on MongoDB leases (a `@DatabaseStorage` without a cluster).
 */
@Application({
  name: "mongo-redis-application",
  version: "1.0.0",
  workflows: [RecountWorkflow, ShelfWorkflow],
  budgets: RECOUNT_BUDGETS,
  executionLimits: { maxConcurrentSteps: 4 },
  storage: { database: RecountDatabaseStorage, cluster: RecountClusterStorage },
})
export class MongoRedisApplication {}
