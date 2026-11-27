/**
 * agbossjs/agboss#891 AC2 / AC3 — MongoRedisApplication's storages, offline: the MongoDB durable
 * bundle beside the Redis coordination bundle, the ids under EXECUTION_ID_STORE bound by the container
 * (no `new`, no second lease store), and the assembly refusing a store class listed beside the
 * storages — before anything connects.
 */
import { createApp, type Class } from "@agboss/core";
import {
  MONGODB_DURABLE_STORES,
  MongoExecutionLeaseRepository,
  MongoFencedEffectRepository,
  MongoOutboundCallRepository,
} from "@agboss/mongodb";
import { REDIS_COORDINATION_STORES, RedisExecutionLeaseRepository } from "@agboss/redis";
import { beforeAll, describe, expect, it } from "vitest";
import { MongoRedisApplication } from "../../src/mongo-redis.application.js";
import { variantWith } from "./fixtures/variant.fixture.js";

// placeholders: no server runs; the short selection timeout makes the one connect that is tried fail at once
beforeAll(() => {
  process.env.MONGODB_URL = "mongodb://127.0.0.1:1/?replicaSet=rs0&serverSelectionTimeoutMS=500";
  process.env.REDIS_URL = "redis://127.0.0.1:1";
  process.env.PII_PSEUDONYM_KEY = "placeholder";
});

const refusalOf = async (application: Class): Promise<string> => {
  try {
    const app = await createApp(application, {});
    await app.close();
    return "assembled";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

describe("#891: the store bundles of MongoDB + Redis", () => {
  it("AC3: the durable bundle leaves the coordination and the lease-fencing stores to the lease backend", () => {
    const names = MONGODB_DURABLE_STORES.map((store) => store.name);

    expect(names).not.toContain("MongoExecutionLeaseRepository");
    expect(names).not.toContain("MongoChildExecutionQueueRepository");
    expect(names).not.toContain("MongoRateLimitRepository");
    expect(names).not.toContain("MongoFencedEffectRepository");
    expect(names).not.toContain("MongoOutboundCallRepository");
    expect(REDIS_COORDINATION_STORES).toContain(RedisExecutionLeaseRepository);
    expect(REDIS_COORDINATION_STORES).toHaveLength(3);
  });

  it("AC1: the application assembles — the first thing to fail is the connection to the placeholder URL", async () => {
    // no rule is broken: the start reaches MongoConnection.onInit, which cannot connect to 127.0.0.1:1 (the 0.5 s selection timeout)
    const refusal = await refusalOf(MongoRedisApplication);

    expect(refusal).toContain("[di.hook-failed] MongoConnection.onInit failed");
    expect(refusal).not.toContain("breaks");
  });

  it.each([
    ["a fenced-effect", MongoFencedEffectRepository],
    ["an outbound-call", MongoOutboundCallRepository],
    ["MongoDB's lease", MongoExecutionLeaseRepository],
  ])("AC2: %s store listed beside the storages is refused at assembly", async (_, store) => {
    // the storage components provide the stores: the driver chooses them, the providers list does not
    expect(await refusalOf(variantWith(store))).toContain("[storage.providers-conflict]");
  });
});
