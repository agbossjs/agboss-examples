import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { StubGateway } from "../../src/stub/stub-gateway.js";
import { StubGatewayClient, StubGatewayError } from "../../src/stub/stub-gateway.client.js";
import { StubFault, StubLevel, type CreateChargeRequest } from "../../src/stub/stub-gateway.types.js";

/**
 * The stub gateway's own behaviour, level by level: a repeat, a conflict, the retention on the
 * scenario's clock, each fault, the lookup and its lag, the state machine, the signed webhooks. A
 * stub that hid a double charge would make every scenario prove nothing.
 */
const time = { now: 1_000_000 };
const stub = await StubGateway.start({ level: StubLevel.Full, now: () => time.now });
const client = new StubGatewayClient(stub.baseUrl);
const HOUR = 60 * 60 * 1000;

const charge = (reference: string, more: Partial<CreateChargeRequest> = {}): CreateChargeRequest => ({
  amountCents: 2500,
  currency: "usd",
  reference,
  capture: true,
  paymentMethod: "card_ok",
  ...more,
});

const reset = (level: StubLevel, more: { lookupLag?: number; keyRetention?: number } = {}): void => {
  stub.reset({ level, now: () => time.now, ...more });
};

beforeEach(() => {
  time.now = 1_000_000;
  reset(StubLevel.Full);
});

afterAll(async () => {
  await stub.close();
});

const failure = (call: Promise<unknown>): Promise<StubGatewayError> =>
  call.then(
    () => {
      throw new Error("expected the stub to refuse");
    },
    (error: unknown) => {
      if (!(error instanceof StubGatewayError)) throw error;
      return error;
    },
  );

describe("Full: keys, a replay, a conflict, a retention", () => {
  it("a repeat under one key replays the first charge (G4): one charge in the records", async () => {
    const first = await client.createCharge(charge("o-1"), { idempotencyKey: "k-1" });
    const again = await client.createCharge(charge("o-1"), { idempotencyKey: "k-1" });

    expect(again).toEqual(first);
    expect(stub.ledger().charges).toHaveLength(1);
    expect(stub.requests.map((request) => request.outcome)).toEqual(["processed", "replayed"]);
  });

  it("the same key with another request is refused (G5): 409 idempotency_conflict, nothing charged", async () => {
    await client.createCharge(charge("o-1"), { idempotencyKey: "k-1" });

    const refused = await failure(client.createCharge(charge("o-1", { amountCents: 9900 }), { idempotencyKey: "k-1" }));

    expect([refused.status, refused.error]).toEqual([409, "idempotency_conflict"]);
    expect(stub.ledger().charges).toHaveLength(1);
  });

  it("a key is kept 24 h on the scenario's clock (G3): a repeat after it is a new charge", async () => {
    await client.createCharge(charge("o-1"), { idempotencyKey: "k-1" });
    time.now += 24 * HOUR - 1;
    await client.createCharge(charge("o-1"), { idempotencyKey: "k-1" });
    expect(stub.ledger().charges).toHaveLength(1);

    time.now += 1;
    await client.createCharge(charge("o-1"), { idempotencyKey: "k-1" });

    expect(stub.ledger().charges).toHaveLength(2);
  });

  it("a duplicate while the first is in progress is refused: 409 in_progress, then the replay", async () => {
    stub.inject(StubFault.HoldRequest, { operation: "charge" });
    const first = client.createCharge(charge("o-1"), { idempotencyKey: "k-1" });
    await until(() => stub.heldCount === 1);

    const duplicate = await failure(client.createCharge(charge("o-1"), { idempotencyKey: "k-1" }));
    stub.release();
    await first;
    const replay = await client.createCharge(charge("o-1"), { idempotencyKey: "k-1" });

    expect([duplicate.status, duplicate.error]).toEqual([409, "in_progress"]);
    expect(replay.chargeId).toBe((await first).chargeId);
    expect(stub.ledger().charges).toHaveLength(1);
  });

  it("the lookup by reference finds the charge, after its lag", async () => {
    reset(StubLevel.Full, { lookupLag: 60_000 });
    const made = await client.createCharge(charge("o-1"), { idempotencyKey: "k-1" });

    expect(await client.findByReference("o-1")).toEqual([]);
    time.now += 60_000;
    expect(await client.findByReference("o-1")).toEqual([made]);
  });
});

describe("the levels", () => {
  it("NoLookup: keys, but GET ?reference= answers 404 not_supported", async () => {
    reset(StubLevel.NoLookup);
    await client.createCharge(charge("o-1"), { idempotencyKey: "k-1" });
    await client.createCharge(charge("o-1"), { idempotencyKey: "k-1" });

    const refused = await failure(client.findByReference("o-1"));

    expect(stub.ledger().charges).toHaveLength(1);
    expect([refused.status, refused.error]).toEqual([404, "not_supported"]);
  });

  it("NoKeys: the key is ignored — a repeat is a second charge", async () => {
    reset(StubLevel.NoKeys);
    await client.createCharge(charge("o-1"), { idempotencyKey: "k-1" });
    await client.createCharge(charge("o-1"), { idempotencyKey: "k-1" });

    expect(stub.ledger().charges).toHaveLength(2);
    expect(stub.moneyFor("o-1")).toMatchObject({ charges: 2, charged: 5000, captured: 5000 });
  });
});

describe("the faults", () => {
  it("AnswerThenDrop: charged, the client sees a network error", async () => {
    stub.inject(StubFault.AnswerThenDrop, { operation: "charge" });

    await expect(client.createCharge(charge("o-1"), { idempotencyKey: "k-1" })).rejects.toThrow(TypeError);
    expect(stub.ledger().charges).toHaveLength(1);
  });

  it("FailBeforeProcessing: 503, nothing charged, the key not kept", async () => {
    stub.inject(StubFault.FailBeforeProcessing, { operation: "charge" });

    const refused = await failure(client.createCharge(charge("o-1"), { idempotencyKey: "k-1" }));
    await client.createCharge(charge("o-1"), { idempotencyKey: "k-1" });

    expect(refused.status).toBe(503);
    expect(stub.requests.map((request) => request.outcome)).toEqual(["failed-before-processing", "processed"]);
    expect(stub.ledger().charges).toHaveLength(1);
  });

  it("ServerErrorAfterProcessing: charged, the client gets 502 — the repeat replays the charge", async () => {
    stub.inject(StubFault.ServerErrorAfterProcessing, { operation: "charge" });

    const refused = await failure(client.createCharge(charge("o-1"), { idempotencyKey: "k-1" }));
    const replay = await client.createCharge(charge("o-1"), { idempotencyKey: "k-1" });

    expect(refused.status).toBe(502);
    expect(replay.status).toBe("succeeded");
    expect(stub.ledger().charges).toHaveLength(1);
  });

  it("HoldAnswer: charged before the answer is held, the answer released by release()", async () => {
    stub.inject(StubFault.HoldAnswer, { operation: "charge" });
    const answer = client.createCharge(charge("o-1"), { idempotencyKey: "k-1" });
    await until(() => stub.heldCount === 1);

    expect(stub.ledger().charges).toHaveLength(1);
    stub.release();
    await expect(answer).resolves.toMatchObject({ status: "succeeded" });
  });
});

describe("the state machine", () => {
  it("captures up to the authorization, refunds up to the capture, a void only before a capture", async () => {
    const authorization = await client.createCharge(charge("o-1", { capture: false, amountCents: 9000 }), { idempotencyKey: "k-1" });
    await client.capture(authorization.chargeId, 6000, { idempotencyKey: "c-1" });
    const overCapture = await failure(client.capture(authorization.chargeId, 6000, { idempotencyKey: "c-2" }));
    await client.refund(authorization.chargeId, 6000, { idempotencyKey: "r-1" });
    const overRefund = await failure(client.refund(authorization.chargeId, 1, { idempotencyKey: "r-2" }));
    const lateVoid = await failure(client.void(authorization.chargeId, { idempotencyKey: "v-1" }));

    expect([overCapture.error, overRefund.error, lateVoid.error]).toEqual(["over_capture", "over_refund", "invalid_state"]);
    expect(stub.moneyFor("o-1")).toMatchObject({ captured: 6000, refunded: 6000, captures: 1, refunds: 1, voids: 0 });
  });

  it("a 3DS charge moves money only when confirmed, once", async () => {
    const secure = await client.createCharge(charge("o-1", { paymentMethod: "card_3ds" }), { idempotencyKey: "k-1" });
    expect(stub.ledger().charges).toHaveLength(0);

    await client.confirm(secure.chargeId, { idempotencyKey: "cf-1" });
    const again = await failure(client.confirm(secure.chargeId, { idempotencyKey: "cf-2" }));

    expect(again.error).toBe("invalid_state");
    expect(stub.moneyFor("o-1")).toMatchObject({ charges: 1, confirms: 1, captured: 2500 });
  });

  it("a declined card answers 402 and moves nothing", async () => {
    const declined = await failure(client.createCharge(charge("o-1", { paymentMethod: "card_declined" }), { idempotencyKey: "k-1" }));

    expect(declined.status).toBe(402);
    expect(stub.ledger().charges).toEqual([]);
  });
});

describe("webhooks", () => {
  it("delivers each event signed (HMAC-SHA256 of the raw body), `times` copies at once", async () => {
    const made = await client.createCharge(charge("o-1"), { idempotencyKey: "k-1" });
    const received: { body: string; signature: string | undefined }[] = [];
    const receiver = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        const signature = request.headers["stub-signature"];
        received.push({ body: Buffer.concat(chunks).toString("utf8"), signature: typeof signature === "string" ? signature : undefined });
        response.writeHead(200).end();
      });
    });
    await new Promise<void>((resolve) => receiver.listen(0, "127.0.0.1", resolve));
    try {
      const { port } = receiver.address() as AddressInfo;
      const event = stub.eventFor("charge.succeeded", made.chargeId);
      const statuses = await stub.deliver([event], { to: `http://127.0.0.1:${String(port)}/`, times: 2 });

      expect(statuses).toEqual([200, 200]);
      expect(received).toHaveLength(2);
      for (const { body, signature } of received)
        expect(signature).toBe(`sha256=${createHmac("sha256", stub.webhookSecret).update(body).digest("hex")}`);
    } finally {
      receiver.close();
    }
  });
});

async function until(isReached: () => boolean): Promise<void> {
  for (let turn = 0; turn < 2000 && !isReached(); turn += 1) await new Promise((resolve) => setTimeout(resolve, 2));
  expect(isReached()).toBe(true);
}
