import { ClusterStorage, env, secret } from "@agboss/core";
import { RedisDriver } from "@agboss/redis";

/**
 * The coordination on one Redis server (`@agboss/redis`): the execution leases, the queue of children
 * launched on any instance, the rate limits. Nothing durable and no fenced effect or outbound call —
 * those check the lease in one transaction with their write, which a Redis lease and a MongoDB row
 * cannot share.
 */
@ClusterStorage({
  name: "recount-cluster-storage",
  driver: RedisDriver({
    url: secret("REDIS_URL"),
    /** One prefix per MongoDB database: a lease key is never deleted, and ids restart with a new database. */
    keyPrefix: env("REDIS_KEY_PREFIX", { default: "agboss:" }),
  }),
})
export class RecountClusterStorage {}
