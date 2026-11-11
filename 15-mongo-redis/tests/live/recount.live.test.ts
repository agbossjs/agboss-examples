/**
 * agbossjs/agboss#891 AC6 — the recount on two instances of MongoRedisApplication against a real
 * replica set and Redis server: skipped (visibly) unless MONGODB_URL and REDIS_URL are set. Each run
 * uses its own database and key prefix; the test environment migrates the schema at start.
 */
import { randomUUID } from "node:crypto";
import { ChildExecutionStatus } from "@agboss/core";
import { testWith } from "@agboss/core/testing";
import { describe, expect } from "vitest";
import { MongoRedisApplication } from "../../src/mongo-redis.application.js";
import { shelvesOf } from "../../src/shelves.js";
import { RecountWorkflowStart } from "../../src/workflows/recount/recount.workflow-start.js";

const isLive = process.env.MONGODB_URL !== undefined && process.env.REDIS_URL !== undefined;
const run = randomUUID().slice(0, 8);
process.env.MONGODB_DATABASE ??= `recount_live_${run}`;

const hostsOf = (...urls: readonly (string | undefined)[]): string[] =>
  urls.flatMap((url) => (url === undefined ? [] : [...url.matchAll(/[@/,]([\w.-]+):\d+/gu)].map((m) => m[1] ?? "")));

describe.skipIf(!isLive)("#891 AC6 live: MongoDB + Redis (MONGODB_URL, REDIS_URL)", () => {
  const test = testWith(MongoRedisApplication, {
    instances: 2,
    allowNetwork: hostsOf(process.env.MONGODB_URL, process.env.REDIS_URL),
  });

  test("#891 AC6: twelve shelves on two instances of the real application — each counted once", async ({ app }) => {
    const shelves = shelvesOf(`live-${run}`, 12);

    const result = await app.execute(RecountWorkflowStart, shelves, { threadId: `live-${run}` });

    const counted = result.children.map((child) => child.output as { shelfId: string });
    expect(result.children.every((child) => child.status === ChildExecutionStatus.Finished)).toBe(true);
    expect(counted.map((one) => one.shelfId).sort()).toEqual(shelves.map((one) => one.shelfId).sort());
    expect(result.output).toMatchObject({ shelves: 12, counted: 12 });
  });
});
