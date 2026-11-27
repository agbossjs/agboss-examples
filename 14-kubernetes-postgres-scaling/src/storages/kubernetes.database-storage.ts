import { DatabaseStorage, env, secret } from "@agboss/core";
import { hours } from "@agboss/core/units";
import { PostgresDriver } from "@agboss/postgres";

/**
 * Every store of the cluster on one PostgreSQL database (`@agboss/postgres`): leases, records,
 * checkpoints, the child queue, fenced effects, outbound calls, … — no shared disk, so any pod on any
 * node continues any tree. The database URL, the pool size and the two keys are references read from
 * the process when a pod starts (`[environment.missing-variable]` names one that is not set).
 */
@DatabaseStorage({
  name: "kubernetes-database-storage",
  driver: PostgresDriver({
    url: secret("POSTGRES_URL"),
    /** Connections of this pod's pool: pods × this ≤ the database's `max_connections`. */
    poolSize: env.integer("POSTGRES_POOL_SIZE", { default: 5 }),
  }),
  auditLogTtl: hours(24),
  ledgerEntriesTtl: hours(24),
  // one key on every pod: business-key fingerprints (a Secret of their own, never the PII key) and
  // key handles agree across instances (Guarantees A8)
  idempotencySecret: secret("IDEMPOTENCY_KEY"),
  piiSecret: secret("PII_PSEUDONYM_KEY"),
})
export class KubernetesDatabaseStorage {}
