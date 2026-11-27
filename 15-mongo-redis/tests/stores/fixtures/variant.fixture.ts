import { Application, type Class, type Provider } from "@agboss/core";
import { RECOUNT_BUDGETS } from "../../../src/budgets/index.js";
import { RecountClusterStorage } from "../../../src/storages/recount.cluster-storage.js";
import { RecountDatabaseStorage } from "../../../src/storages/recount.database-storage.js";
import { RecountWorkflow } from "../../../src/workflows/recount/recount.workflow.js";
import { ShelfWorkflow } from "../../../src/workflows/shelf/shelf.workflow.js";

/** MongoRedisApplication's storages plus `extra` providers — what an application must not list beside them. */
export function variantWith(...extra: readonly Provider[]): Class {
  @Application({
    name: "mongo-redis-variant-application",
    version: "1.0.0",
    workflows: [RecountWorkflow, ShelfWorkflow],
    budgets: RECOUNT_BUDGETS,
    storage: { database: RecountDatabaseStorage, cluster: RecountClusterStorage },
    providers: [...extra],
  })
  class MongoRedisVariantApplication {}
  return MongoRedisVariantApplication;
}
