/**
 * agbossjs/agboss#891 AC6 — the recount on two instances of the local twin (the same workflows as
 * MongoRedisApplication, on SQLite): every shelf is queued as a child for any instance, counted once
 * and joined; the totals add up.
 */
import { ChildExecutionStatus } from "@agboss/core";
import { testWith } from "@agboss/core/testing";
import { expect } from "vitest";
import { LocalMongoRedisApplication } from "../../src/local/local-mongo-redis.application.js";
import { shelvesOf } from "../../src/shelves.js";
import { RecountWorkflowStart } from "../../src/workflows/recount/recount.workflow-start.js";

const test = testWith(LocalMongoRedisApplication, { instances: 2 });

test("#891 AC6: twelve shelves on two instances — each counted once, the totals add up", async ({ app }) => {
  const shelves = shelvesOf("wf", 12);

  const result = await app.execute(RecountWorkflowStart, shelves, { threadId: "wf-recount" });

  const counted = result.children.map((child) => child.output as { shelfId: string; items: number });
  expect(result.children.every((child) => child.status === ChildExecutionStatus.Finished)).toBe(true);
  expect(counted.map((one) => one.shelfId).sort()).toEqual(shelves.map((one) => one.shelfId).sort());
  expect(result.output).toMatchObject({
    shelves: 12,
    counted: 12,
    items: shelves.reduce((sum, shelf) => sum + shelf.scans.length, 0),
  });
});
