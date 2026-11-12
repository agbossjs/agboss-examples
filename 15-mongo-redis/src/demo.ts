// `npm run demo` — offline, no model, no server: two instances of the recount on one SQLite file
// (LocalMongoRedisApplication). `npm run demo:live` — the same on MongoDB + Redis
// (MongoRedisApplication; MONGODB_URL and REDIS_URL set, the schema migrated first).
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp, type App } from "@agboss/core";
import { migrateMongodb } from "@agboss/mongodb";
import { LocalMongoRedisApplication } from "./local/local-mongo-redis.application.js";
import { MongoRedisApplication } from "./mongo-redis.application.js";
import { shelvesOf } from "./shelves.js";
import { RecountWorkflowStart } from "./workflows/recount/recount.workflow-start.js";

const isLive = process.argv.includes("--live");

async function instances(): Promise<readonly [App, App]> {
  if (!isLive) {
    process.env.SQLITE_PATH ??= join(mkdtempSync(join(tmpdir(), "agboss-recount-")), "demo.sqlite");
    return [await createApp(LocalMongoRedisApplication), await createApp(LocalMongoRedisApplication)];
  }
  const url = process.env.MONGODB_URL;
  if (url === undefined || process.env.REDIS_URL === undefined) {
    throw new Error("demo:live needs MONGODB_URL and REDIS_URL set (see .env.example)");
  }
  // the schema first, as a deploy's Job runs `agboss-mongodb migrate`; a second run applies nothing
  const report = await migrateMongodb({ url, database: process.env.MONGODB_DATABASE });
  console.log(`schema: version ${String(report.version)} (database ${report.database})`);
  return [await createApp(MongoRedisApplication), await createApp(MongoRedisApplication)];
}

const [a, b] = await instances();
try {
  const shelves = shelvesOf("demo", 12);
  const result = await a.execute(RecountWorkflowStart, shelves, { threadId: `recount-${String(Date.now())}` });
  const counted = result.children.map((child) => child.output);
  console.log(`${isLive ? "MongoDB + Redis" : "local SQLite twin"}: recount done`, JSON.stringify(result.output));
  console.log(`every shelf once: ${String(new Set(counted.map((one) => JSON.stringify(one))).size === shelves.length)}`);
} finally {
  await Promise.all([a.close(), b.close()]);
}
