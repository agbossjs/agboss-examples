/**
 * The other system the verification trusts (agbossjs/agboss#487): one entry per Idempotency-Key —
 * a repeat gets the first entry and is counted as a request, never as a second entry —, a lookup
 * by job for `reconcile`, and holds that keep a work answer back, or apply a ledger entry and keep
 * its answer back (the crash after the external effect).
 */
import { afterEach, describe, expect, it } from "vitest";
import { startLedgerStub, type LedgerStub } from "../../src/stub/ledger-stub.js";

let stub: LedgerStub | undefined;
afterEach(async () => {
  await stub?.close();
});
const started = async (): Promise<LedgerStub> => (stub = await startLedgerStub(0, "127.0.0.1"));
const post = (base: string, path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
const work = (jobId: string) => ({ jobId, durationMs: 0, executionId: "e", rootExecutionId: "r", instanceId: "i", pod: "p", token: 1 });

describe("the ledger stub", () => {
  it("applies one entry per Idempotency-Key; a repeat gets the first entry back", async () => {
    const running = await started();
    const { url } = running;
    const state = () => running.state();
    const first = await (await post(url, "/ledger", { jobId: "j", deliveredBy: "a", pod: "p" }, { "idempotency-key": "k1" })).json();
    const again = await (await post(url, "/ledger", { jobId: "j", deliveredBy: "b", pod: "q" }, { "idempotency-key": "k1" })).json();

    expect(again).toEqual(first);
    expect(state().entries).toHaveLength(1);
    expect(state().ledgerRequests.map((request) => request.isRepeat)).toEqual([false, true]);
  });

  it("a second key for one job is a second entry: what the verification counts as a duplicate", async () => {
    const running = await started();
    const { url } = running;
    const state = () => running.state();
    await post(url, "/ledger", { jobId: "j", deliveredBy: "a", pod: "p" }, { "idempotency-key": "k1" });
    await post(url, "/ledger", { jobId: "j", deliveredBy: "a", pod: "p" }, { "idempotency-key": "k2" });

    expect(state().entries.filter((entry) => entry.jobId === "j")).toHaveLength(2);
  });

  it("looks an entry up by job, 404 when there is none", async () => {
    const { url } = await started();
    expect((await fetch(`${url}/ledger?jobId=nope`)).status).toBe(404);
    await post(url, "/ledger", { jobId: "j", deliveredBy: "a", pod: "p" }, { "idempotency-key": "k1" });
    expect(await (await fetch(`${url}/ledger?jobId=j`)).json()).toMatchObject({ jobId: "j" });
  });

  it("a work hold keeps the answer back until released, once; the next call is answered", async () => {
    const running = await started();
    const { url } = running;
    const state = () => running.state();
    await post(url, "/control/holds", { jobId: "z", stage: "work", times: 1 });
    let answered = false;
    const held = post(url, "/work", work("z")).then(() => (answered = true));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(answered).toBe(false);
    expect((await post(url, "/work", work("z"))).status).toBe(200);

    expect(await (await post(url, "/control/release", { jobId: "z", stage: "work" })).json()).toEqual({ released: 1 });
    await held;
    expect(state().work.map((call) => call.held)).toEqual([true, false]);
  });

  it("a ledger hold applies the entry first, then keeps the answer back", async () => {
    const running = await started();
    const { url } = running;
    const state = () => running.state();
    await post(url, "/control/holds", { jobId: "r", stage: "ledger" });
    const held = post(url, "/ledger", { jobId: "r", deliveredBy: "a", pod: "p" }, { "idempotency-key": "kr" });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(state().entries.map((entry) => entry.jobId)).toEqual(["r"]);
    await post(url, "/control/release", { jobId: "r", stage: "ledger" });
    expect((await held).status).toBe(200);
  });

  it("refuses a request without its fields", async () => {
    const { url } = await started();
    expect((await post(url, "/ledger", { jobId: "j" })).status).toBe(400);
    expect((await post(url, "/work", { jobId: "j" })).status).toBe(400);
  });
});
