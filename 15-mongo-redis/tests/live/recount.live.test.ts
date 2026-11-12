/**
 * agbossjs/agboss#891 AC6 — the recount on two instances of MongoRedisApplication against a real
 * replica set and Redis server: skipped (visibly) unless MONGODB_URL and REDIS_URL are set. Two
 * `createApp` instances on the system clock, as two pods are — the leases and the queue on Redis's own
 * time, nothing on a test's virtual clock. Each run uses its own database and its own Redis key
 * prefix (a new database restarts the execution ids: they must not meet the lease keys of an earlier
 * run's); the test environment migrates the schema at start.
 */
import { randomUUID } from "node:crypto";
import { ChildExecutionStatus, createApp } from "@agboss/core";
import { describe, expect, it } from "vitest";
import { MongoRedisApplication } from "../../src/mongo-redis.application.js";
import { shelvesOf } from "../../src/shelves.js";
import { RecountWorkflowStart } from "../../src/workflows/recount/recount.workflow-start.js";

const isLive = process.env.MONGODB_URL !== undefined && process.env.REDIS_URL !== undefined;
const run = randomUUID().slice(0, 8);

describe.skipIf(!isLive)("#891 AC6 live: MongoDB + Redis (MONGODB_URL, REDIS_URL)", () => {
  it(
    "#891 AC6: twelve shelves on two instances of the real application — each counted once",
    async () => {
      process.env.MONGODB_DATABASE = `recount_live_${run}`;
      process.env.REDIS_KEY_PREFIX = `recount_live_${run}:`;
      const a = await createApp(MongoRedisApplication, { env: "test" });
      const b = await createApp(MongoRedisApplication, { env: "test" });
      try {
        const shelves = shelvesOf(`live-${run}`, 12);

        const result = await a.execute(RecountWorkflowStart, shelves, { threadId: `live-${run}` });

        const counted = result.children.map((child) => child.output as { shelfId: string });
        expect(result.children.every((child) => child.status === ChildExecutionStatus.Finished)).toBe(true);
        expect(counted.map((one) => one.shelfId).sort()).toEqual(shelves.map((one) => one.shelfId).sort());
        expect(result.output).toMatchObject({ shelves: 12, counted: 12 });
      } finally {
        await Promise.all([a.close(), b.close()]);
      }
    },
    60_000,
  );
});
