import { request as httpsRequest } from "node:https";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { startAdyenStub } from "../../src/gateways/adyen/stub/adyen.stub.js";
import { startCardcomStub } from "../../src/gateways/cardcom/stub/cardcom.stub.js";
import { startCheckoutComStub } from "../../src/gateways/checkout-com/stub/checkout-com.stub.js";
import { startPayPalStub } from "../../src/gateways/paypal/stub/paypal.stub.js";
import { STRIPE_SEARCH_LAG, startStripeStub } from "../../src/gateways/stripe/stub/stripe.stub.js";
import { StubFault, type StubKit } from "../../src/stub-kit/stub-kit.js";

/**
 * Each stub against the docs it quotes (its file cites the page and the date): a stub that
 * disagreed with its gateway's documented behaviour would make every scenario prove nothing.
 */
const HOUR = 60 * 60 * 1000;
const time = { now: 1_000_000 };
const stripe = await startStripeStub();
const cko = await startCheckoutComStub();
const adyen = await startAdyenStub();
const cardcom = await startCardcomStub();
const paypal = await startPayPalStub();
const all: StubKit[] = [stripe, cko, adyen, cardcom, paypal.stub];

beforeEach(() => {
  time.now = 1_000_000;
  for (const stub of all) stub.reset(() => time.now);
});
afterAll(async () => {
  for (const stub of all) await stub.close();
});

interface Answer {
  readonly status: number;
  readonly headers: Headers | Record<string, string | string[] | undefined>;
  readonly body: Record<string, unknown>;
}

async function post(base: string, path: string, body: string, headers: Record<string, string>): Promise<Answer> {
  const response = await fetch(`${base}${path}`, { method: "POST", headers, body });
  return { status: response.status, headers: response.headers, body: (await response.json()) as Record<string, unknown> };
}
const json = (base: string, path: string, body: object, headers: Record<string, string> = {}) =>
  post(base, path, JSON.stringify(body), { "content-type": "application/json", ...headers });

async function until(isReached: () => boolean): Promise<void> {
  for (let turn = 0; turn < 2000 && !isReached(); turn += 1) await new Promise((resolve) => setTimeout(resolve, 2));
}

describe("the Stripe stub", () => {
  const form = (key: string, amount = 2500) =>
    post(stripe.baseUrl, "/v1/payment_intents", `amount=${String(amount)}&currency=usd&confirm=true&metadata[order_id]=o-1`, { "content-type": "application/x-www-form-urlencoded", "idempotency-key": key });

  it("replays the saved response under its key, `Idempotent-Replayed: true`; refuses other parameters; forgets after 24 h", async () => {
    const first = await form("k-1");
    const again = await form("k-1");
    const other = await form("k-1", 9900);
    time.now += 24 * HOUR;
    await form("k-1");

    expect(again.body).toEqual(first.body);
    expect((again.headers as Headers).get("idempotent-replayed")).toBe("true");
    expect([other.status, (other.body["error"] as { type: string }).type]).toEqual([400, "idempotency_error"]);
    expect(stripe.moneyFor("o-1").charges).toBe(2);
  });

  it("answers 409 to a duplicate still executing", async () => {
    stripe.inject(StubFault.HoldRequest, { operation: "charge" });
    const first = form("k-1");
    await until(() => stripe.heldCount === 1);
    const duplicate = await form("k-1");
    stripe.release();
    await first;
    expect(duplicate.status).toBe(409);
  });

  it("its search lags behind a new PaymentIntent", async () => {
    await form("k-1");
    const search = async () => ((await (await fetch(`${stripe.baseUrl}/v1/payment_intents/search?query=metadata['order_id']:'o-1'`)).json()) as { data: unknown[] }).data;
    expect(await search()).toHaveLength(0);
    time.now += STRIPE_SEARCH_LAG;
    expect(await search()).toHaveLength(1);
  });
});

describe("the Checkout.com stub", () => {
  const pay = (key: string) => json(cko.baseUrl, "/payments", { amount: 2500, currency: "USD", reference: "o-1" }, { "cko-idempotency-key": key });

  it("replays a 2xx under its key for 72 h; a 4xx is not saved — a repeat runs again", async () => {
    const first = await pay("k-1");
    expect((await pay("k-1")).body).toEqual(first.body);
    const id = String(first.body["id"]);
    const over = await json(cko.baseUrl, `/payments/${id}/refunds`, { amount: 9999 }, { "cko-idempotency-key": "r-1" });
    const retried = await json(cko.baseUrl, `/payments/${id}/refunds`, { amount: 1000 }, { "cko-idempotency-key": "r-1" });
    time.now += 72 * HOUR;
    await pay("k-1");

    expect(over.status).toBe(422);
    expect(retried.status).toBe(202);
    expect(cko.moneyFor("o-1")).toMatchObject({ charges: 2, refunds: 1 });
  });

  it("answers 409 to a concurrent duplicate; finds payments by reference", async () => {
    cko.inject(StubFault.HoldRequest, { operation: "charge" });
    const first = pay("k-1");
    await until(() => cko.heldCount === 1);
    const duplicate = await pay("k-1");
    cko.release();
    await first;
    const list = (await (await fetch(`${cko.baseUrl}/payments?reference=o-1`)).json()) as { data: unknown[] };
    expect(duplicate.status).toBe(409);
    expect(list.data).toHaveLength(1);
  });
});

describe("the Adyen stub", () => {
  const pay = (key: string) => json(adyen.baseUrl, "/v72/payments", { amount: { value: 2500, currency: "USD" }, reference: "o-1" }, { "idempotency-key": key });

  it("returns the first response for 7 days; refuses a key above 64 characters", async () => {
    const first = await pay("k-1");
    expect((await pay("k-1")).body).toEqual(first.body);
    time.now += 7 * 24 * HOUR;
    await pay("k-1");
    const long = await pay("k".repeat(65));
    expect(long.body["errorCode"]).toBe("702");
    expect(adyen.moneyFor("o-1").charges).toBe(2);
  });

  it("answers 422 with code 704 and `transient-error: true` to a duplicate in progress", async () => {
    adyen.inject(StubFault.HoldRequest, { operation: "charge" });
    const first = pay("k-1");
    await until(() => adyen.heldCount === 1);
    const duplicate = await pay("k-1");
    adyen.release();
    await first;
    expect([duplicate.status, duplicate.body["errorCode"], (duplicate.headers as Headers).get("transient-error")]).toEqual([422, "704", "true"]);
  });
});

describe("the CardCom stub", () => {
  const charge = (externalId: string, replay: boolean) =>
    json(cardcom.baseUrl, "/api/v11/Transactions/Transaction", { Amount: 25, ReturnValue: "o-1", ExternalUniqTranId: externalId, ExternalUniqUniqTranIdResponse: replay });

  it("with the flag true replays the original answer; with false answers 608; a refused attempt does not use the id up", async () => {
    const first = await charge("ext-1", true);
    const replayed = await charge("ext-1", true);
    const refused = await charge("ext-1", false);
    const tooLong = await charge("x".repeat(26), true);

    expect(replayed.body).toEqual(first.body);
    expect(refused.body["ResponseCode"]).toBe(608);
    expect(tooLong.body["ResponseCode"]).not.toBe(0);
    expect(cardcom.moneyFor("o-1").charges).toBe(1);
  });

  it("does not protect a concurrent duplicate: both are processed (KB 509)", async () => {
    cardcom.inject(StubFault.HoldRequest, { operation: "charge" });
    const first = charge("ext-1", true);
    await until(() => cardcom.heldCount === 1);
    await charge("ext-1", true);
    cardcom.release();
    await first;
    expect(cardcom.moneyFor("o-1").charges).toBe(2);
  });

  it("refunds take no key: every request refunds", async () => {
    const id = Number((await charge("ext-1", true)).body["TranzactionId"]);
    for (let n = 0; n < 2; n += 1) await json(cardcom.baseUrl, "/api/v11/Transactions/RefundByTransactionId", { TransactionId: id, PartialSum: 5 });
    expect(cardcom.moneyFor("o-1").refunds).toBe(2);
  });
});

describe("the PayPal stub (TLS)", () => {
  const port = Number(new URL(paypal.stub.baseUrl).port);
  const call = (path: string, body: object, requestId?: string): Promise<Answer> =>
    new Promise((resolve, reject) => {
      const request = httpsRequest(
        { host: "127.0.0.1", port, path, method: "POST", ca: paypal.certificate, servername: "api-m.sandbox.paypal.com", headers: { "content-type": "application/json", ...(requestId === undefined ? {} : { "paypal-request-id": requestId }) } },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("end", () => {
            resolve({ status: response.statusCode ?? 0, headers: response.headers, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown> });
          });
        },
      );
      request.on("error", reject);
      request.end(JSON.stringify(body));
    });
  const create = (key: string) => call("/v2/checkout/orders", { intent: "CAPTURE", purchase_units: [{ reference_id: "o-1", amount: { currency_code: "USD", value: "25.00" } }] }, key);

  it("a repeat returns the current status, not the first answer; a second capture under another id is ORDER_ALREADY_CAPTURED", async () => {
    const created = await create("c-1");
    const id = String(created.body["id"]);
    await call(`/v2/checkout/orders/${id}/capture`, {}, "cap-1");
    const repeat = await create("c-1");
    const again = await call(`/v2/checkout/orders/${id}/capture`, {}, "cap-2");

    expect(created.body["status"]).toBe("APPROVED");
    expect(repeat.body["status"]).toBe("COMPLETED");
    expect([again.status, (again.body["details"] as { issue: string }[])[0]?.issue]).toEqual([422, "ORDER_ALREADY_CAPTURED"]);
    expect(paypal.stub.moneyFor("o-1").charges).toBe(1);
  });

  it("keeps an order's request id 6 hours", async () => {
    await create("c-1");
    time.now += 6 * HOUR;
    const later = await create("c-1");
    expect(later.body["id"]).toBe("ORDER000002");
  });
});
