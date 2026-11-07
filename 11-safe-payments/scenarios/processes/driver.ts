import { fork, type ChildProcess } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { StubGateway } from "../../src/stub/stub-gateway.js";
import { StubFault, StubLevel } from "../../src/stub/stub-gateway.types.js";
import { orderOf } from "../checkout.js";
import { until } from "../outcome.js";
import { Variant, type ScenarioOutcome } from "../scenario.types.js";

/** What a pod says over IPC. */
interface PodMessage {
  readonly ready?: string;
  readonly at?: string;
  readonly ended?: string;
}

/** A pod: its process and what it said. */
interface Pod {
  readonly process: ChildProcess;
  readonly said: PodMessage[];
}

function podOf(env: NodeJS.ProcessEnv): Pod {
  const child = fork(join(import.meta.dirname, "pod.ts"), [], {
    cwd: join(import.meta.dirname, "..", ".."),
    env,
    execArgv: ["--import", "tsx"],
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  const pod: Pod = { process: child, said: [] };
  child.on("message", (message: PodMessage) => pod.said.push(message));
  return pod;
}

/** What the shop's books on the file say about an order (read from the test, the file shared). */
function orderRowOf(path: string, orderId: string): { status: string; heldCents: number } | undefined {
  const database = new DatabaseSync(path, { readOnly: true });
  try {
    const row = database
      .prepare("SELECT status, held_cents AS heldCents FROM orders WHERE order_id = ?")
      .get(orderId) as { status: string; heldCents: number } | undefined;
    return row;
  } catch {
    return undefined; // the table is not there yet
  } finally {
    database.close();
  }
}

/** Real time: a lease (30 s), a sweep (30 s), the start of a pod — and a margin. */
const RECOVERY_BOUND = 150_000;

/**
 * PS2 / PS5 on real processes: two pods on one SQLite file and the stub gateway; pod 1 is
 * `SIGKILL`ed — after its charge was answered and before the step ended (PS2), or while the stub
 * holds the charge's answer (PS5) — and pod 2's own recovery sweep finishes the order. The right
 * version only: the in-process runs show both versions.
 */
export async function onRealProcesses(stub: StubGateway, kind: "ps2" | "ps5"): Promise<ScenarioOutcome> {
  stub.reset({ level: StubLevel.Full, now: () => Date.now() });
  const sqlitePath = join(mkdtempSync(join(tmpdir(), "safe-payments-pods-")), "stores.sqlite");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    SAFE_PAYMENTS_SQLITE_PATH: sqlitePath,
    STUB_GATEWAY_URL: stub.baseUrl,
    STUB_WEBHOOK_SECRET: stub.webhookSecret,
    PII_PSEUDONYM_KEY: process.env.PII_PSEUDONYM_KEY ?? "safe-payments-offline-pseudonym-key-32b!",
    IDEMPOTENCY_KEY: process.env.IDEMPOTENCY_KEY ?? "safe-payments-offline-idempotency-key",
  };
  const order = orderOf(`${kind}-process-order`, 2500);
  const first = podOf({ ...env, ...(kind === "ps2" ? { POD_HOLD_EFFECT: "book-charge" } : {}) });
  const pods = { second: undefined as Pod | undefined };
  try {
    // one after the other: the first creates the file's tables
    await until(() => first.said.some((m) => m.ready !== undefined), "pod 1 ready", 60_000);
    const second = podOf(env);
    pods.second = second;
    await until(() => second.said.some((m) => m.ready !== undefined), "pod 2 ready", 60_000);
    if (kind === "ps5") stub.inject(StubFault.HoldAnswer, { operation: "charge" });
    first.process.send({ execute: order });
    if (kind === "ps2") await until(() => first.said.some((m) => m.at === "effect:book-charge"), "pod 1 charged, its step not ended", 60_000);
    else await until(() => stub.heldCount === 1, "the stub charged and holds the answer", 60_000);
    first.process.kill("SIGKILL");
    await until(() => orderRowOf(sqlitePath, order.orderId)?.status === "paid", "pod 2 recovered the order", RECOVERY_BOUND);
    stub.release();
    const money = stub.moneyFor(order.orderId);
    const row = orderRowOf(sqlitePath, order.orderId);
    return {
      id: kind,
      variant: Variant.Right,
      row: `${kind} process`,
      level: StubLevel.Full,
      charges: money.charges,
      captures: money.captures,
      refunds: money.refunds,
      voids: money.voids,
      confirms: money.confirms,
      amountCharged: money.charged,
      amountCaptured: money.captured,
      amountRefunded: money.refunded,
      lost: Math.abs(money.captured - money.refunded - (row?.heldCents ?? 0)),
      orderStatus: row?.status,
      notes: [`pod 1: SIGKILL`, `requests at the stub: ${stub.requests.map((request) => `${request.operation} ${request.outcome}`).join(", ")}`],
    };
  } finally {
    stub.release();
    first.process.kill("SIGKILL");
    pods.second?.process.kill("SIGKILL");
  }
}
