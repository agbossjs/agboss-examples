import { DatabaseStorage, env, secret } from "@agboss/core";
import { hours } from "@agboss/core/units";
import { MongoDriver } from "@agboss/mongodb";

/**
 * Everything durable on one MongoDB replica set (`@agboss/mongodb`): records, checkpoints, pauses,
 * execution trees, history, budgets, mesh requests, the audit log, A2A tasks, and the lease store that
 * keeps the execution ids and the marks the Redis leases hand back to (`EXECUTION_ID_STORE`, bound by
 * the container). The URL, the database and the PII key are references read once when a pod starts
 * (`[environment.missing-variable]` names one that is not set); the driver is the only source of the
 * connection's settings.
 */
@DatabaseStorage({
  name: "recount-database-storage",
  driver: MongoDriver({
    url: secret("MONGODB_URL"),
    /** One Redis key prefix per database: the execution ids start again with a new one. */
    database: env("MONGODB_DATABASE", { default: "agboss" }),
  }),
  auditLogTtl: hours(24),
  ledgerEntriesTtl: hours(24),
  piiSecret: secret("PII_PSEUDONYM_KEY"),
})
export class RecountDatabaseStorage {}
