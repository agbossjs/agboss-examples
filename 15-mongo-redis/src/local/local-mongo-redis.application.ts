import { Application } from "@agboss/core";
import { RECOUNT_BUDGETS } from "../budgets/index.js";
import { RecountWorkflow } from "../workflows/recount/recount.workflow.js";
import { ShelfWorkflow } from "../workflows/shelf/shelf.workflow.js";
import { LocalDatabaseStorage } from "./local.database-storage.js";

/**
 * The same workflows on one machine (`npm test`, `npm run demo`, offline): the core's SQLite stores in
 * one file (`LocalDatabaseStorage`) in place of MongoDB and Redis — the workflows' code is the one
 * that runs on both.
 */
@Application({
  name: "local-mongo-redis-application",
  version: "1.0.0",
  storage: LocalDatabaseStorage,
  workflows: [RecountWorkflow, ShelfWorkflow],
  budgets: RECOUNT_BUDGETS,
  executionLimits: { maxConcurrentSteps: 4 },
})
export class LocalMongoRedisApplication {}
