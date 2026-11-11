import { Application, EXECUTION_ID_STORE, provide, type Class, type Provider } from "@agboss/core";
import { MONGODB_DURABLE_STORES, MongoExecutionLeaseRepository } from "@agboss/mongodb";
import { REDIS_COORDINATION_STORES } from "@agboss/redis";
import { RECOUNT_BUDGETS } from "../../../src/budgets/index.js";
import { AppEnvironment } from "../../../src/environments/app.environment.js";
import { RecountWorkflow } from "../../../src/workflows/recount/recount.workflow.js";
import { ShelfWorkflow } from "../../../src/workflows/shelf/shelf.workflow.js";

/** MongoRedisApplication's stores plus `extra` — what an application must not list beside Redis leases. */
export function variantWith(...extra: readonly Provider[]): Class {
  @Application({
    name: "mongo-redis-variant-application",
    version: "1.0.0",
    environment: AppEnvironment,
    workflows: [RecountWorkflow, ShelfWorkflow],
    budgets: RECOUNT_BUDGETS,
    providers: [
      ...MONGODB_DURABLE_STORES,
      ...REDIS_COORDINATION_STORES,
      provide(EXECUTION_ID_STORE, MongoExecutionLeaseRepository),
      ...extra,
    ],
  })
  class MongoRedisVariantApplication {}
  return MongoRedisVariantApplication;
}
