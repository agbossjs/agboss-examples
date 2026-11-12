import type { Secret } from "@agboss/core";

/** What an instance reads: the MongoDB replica set of the durable stores and the Redis of the leases. */
export class AppEnvironment {
  /** The replica set (`@agboss/mongodb`): records, checkpoints, pauses, history, budgets, the audit log. */
  mongodbUrl!: Secret;
  /** The database of the stores' collections (default: the URL's, else `agboss`). */
  mongodbDatabase?: string;
  /** What the start does with the schema: `check` (the default) or `migrate-on-start` (`SchemaSetup`). */
  mongodbSchemaSetup?: string;
  /** The Redis server (`@agboss/redis`): the leases, the child queue and the rate limits. */
  redisUrl!: Secret;
  /**
   * What every Redis key starts with (default `agboss:`). One prefix per MongoDB database: the
   * execution ids restart with a new database, and a lease key of an old execution of the same id
   * — a retired lease is never taken again — would refuse the new one (the claim fails with
   * `RedisLeaseKeyConflictError`).
   */
  redisKeyPrefix?: string;
}
