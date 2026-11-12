import { Application, EXECUTION_ID_STORE, provide } from "@agboss/core";
import { MONGODB_DURABLE_STORES, MongoExecutionLeaseRepository } from "@agboss/mongodb";
import { REDIS_COORDINATION_STORES } from "@agboss/redis";
import { RECOUNT_BUDGETS } from "./budgets/index.js";
import { AppEnvironment } from "./environments/app.environment.js";
import { RecountWorkflow } from "./workflows/recount/recount.workflow.js";
import { ShelfWorkflow } from "./workflows/shelf/shelf.workflow.js";

/**
 * The recount on MongoDB + Redis (agbossjs/agboss#891): Redis coordinates — the leases, the child
 * queue, the rate limits (`REDIS_COORDINATION_STORES`) — and MongoDB keeps everything durable —
 * records, checkpoints, pauses, trees, history, budgets, mesh requests, the audit log, A2A tasks
 * (`MONGODB_DURABLE_STORES`: no lease, queue, rate-limit, fenced-effect or outbound-call store).
 * The Redis lease store keeps no execution ids of its own: the container creates MongoDB's lease
 * store under `EXECUTION_ID_STORE` for it (no `new`, and no second lease store). Fenced effects and
 * outbound calls need their lease check in one transaction with the leases, which Redis cannot give,
 * so none is listed: an effect that must happen once runs on MongoDB leases (`MONGODB_STORES`).
 */
@Application({
  name: "mongo-redis-application",
  version: "1.0.0",
  environment: AppEnvironment,
  workflows: [RecountWorkflow, ShelfWorkflow],
  budgets: RECOUNT_BUDGETS,
  maxConcurrentSteps: 4,
  providers: [
    ...MONGODB_DURABLE_STORES,
    ...REDIS_COORDINATION_STORES,
    provide(EXECUTION_ID_STORE, MongoExecutionLeaseRepository),
  ],
})
export class MongoRedisApplication {}
