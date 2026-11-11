/**
 * agbossjs/agboss#891 AC2 / AC3 — MongoRedisApplication's stores, offline: the durable bundle beside
 * the Redis coordination bundle, the ids under EXECUTION_ID_STORE (no `new`, no second lease store),
 * and the assembly refusing what Redis leases cannot protect — before anything connects.
 */
import { createApp, type Provider } from "@agboss/core";
import {
  MONGODB_DURABLE_STORES,
  MongoExecutionLeaseRepository,
  MongoFencedEffectRepository,
  MongoOutboundCallRepository,
} from "@agboss/mongodb";
import { REDIS_COORDINATION_STORES, RedisExecutionLeaseRepository } from "@agboss/redis";
import { beforeAll, describe, expect, it } from "vitest";
import { variantWith } from "./fixtures/variant.fixture.js";

// placeholders: nothing is started — the assembly fails before any store connects
beforeAll(() => {
  process.env.MONGODB_URL = "mongodb://127.0.0.1:1/?replicaSet=rs0";
  process.env.REDIS_URL = "redis://127.0.0.1:1";
});

const refusalOf = async (extra: Provider): Promise<string> => {
  try {
    const app = await createApp(variantWith(extra), { env: "test" });
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

  it("AC2: a fenced-effect store beside Redis leases is refused at assembly", async () => {
    expect(await refusalOf(MongoFencedEffectRepository)).toContain("[application.store-backend-mismatch]");
  });

  it("AC2: an outbound-call store beside Redis leases is refused at assembly", async () => {
    expect(await refusalOf(MongoOutboundCallRepository)).toContain("[application.store-backend-mismatch]");
  });

  it("AC2: MongoDB's lease store listed as a class is a second lease store — the token is what avoids it", async () => {
    expect(await refusalOf(MongoExecutionLeaseRepository)).toContain("[di.ambiguous-implementation]");
  });
});
