// The "other system" the workers call (agbossjs/agboss#487): a plain node:http server, outside
// AGBoss — its state is the evidence of what really happened outside the cluster's stores.
//
//   POST /work          the job's remote work: answered after `durationMs` (or held by the scenario)
//   POST /ledger        the external side effect: one entry per Idempotency-Key, a repeat answered
//                       with the first entry (the way a payment API deduplicates)
//   GET  /ledger?jobId  the entry of a job, or 404 — what `reconcile` asks
//   POST /control/holds {jobId, stage, times}   hold the next `times` calls of a job at a stage
//   POST /control/release {jobId, stage}        answer the held calls
//   GET  /control/state                          every work call, ledger request and entry
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

/** Where the scenario can hold a job: its remote work, or the answer of its ledger entry. */
export type HoldStage = "work" | "ledger";

/** One `POST /work`: who worked on which job, under which lease token. */
export interface WorkCall {
  readonly callId: number;
  readonly jobId: string;
  readonly executionId: string;
  readonly rootExecutionId: string;
  readonly instanceId: string;
  readonly pod: string;
  readonly token: number;
  readonly receivedAt: string;
  answeredAt?: string;
  held: boolean;
}

/** One `POST /ledger` as it arrived: a repeat of a key is a request, never a second entry. */
export interface LedgerRequest {
  readonly jobId: string;
  readonly idempotencyKey: string;
  readonly pod: string;
  readonly receivedAt: string;
  readonly isRepeat: boolean;
  held: boolean;
}

/** One applied entry: the external effect itself. */
export interface LedgerEntry {
  readonly entryId: string;
  readonly jobId: string;
  readonly idempotencyKey: string;
  readonly deliveredBy: string;
  readonly appliedAt: string;
}

/** Everything the stub saw, as `GET /control/state` answers it. */
export interface StubState {
  readonly work: readonly WorkCall[];
  readonly ledgerRequests: readonly LedgerRequest[];
  readonly entries: readonly LedgerEntry[];
}

interface Hold {
  readonly jobId: string;
  readonly stage: HoldStage;
  times: number;
}

interface Waiting {
  readonly jobId: string;
  readonly stage: HoldStage;
  readonly answer: () => void;
}

/** A running stub: its URL, its state, how to stop it. */
export interface LedgerStub {
  readonly url: string;
  readonly server: Server;
  state(): StubState;
  close(): Promise<void>;
}

async function bodyOf(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  const parsed: unknown = text.trim() === "" ? {} : JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("a JSON object is expected");
  return parsed as Record<string, unknown>;
}

const textOf = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value === "") throw new Error(`${field}: a text is expected`);
  return value;
};

const numberOf = (value: unknown, field: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`${field}: a number ≥ 0 is expected`);
  return value;
};

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

/** Starts the stub on `port` (0: any free port). */
export async function startLedgerStub(port: number, host = "0.0.0.0"): Promise<LedgerStub> {
  const work: WorkCall[] = [];
  const ledgerRequests: LedgerRequest[] = [];
  const entries: LedgerEntry[] = [];
  const holds: Hold[] = [];
  const waiting: Waiting[] = [];
  const now = (): string => new Date().toISOString();

  /** Whether the call is to be held: a matching hold with times left takes one. */
  const takeHold = (jobId: string, stage: HoldStage): boolean => {
    const hold = holds.find((candidate) => candidate.jobId === jobId && candidate.stage === stage && candidate.times > 0);
    if (hold === undefined) return false;
    hold.times -= 1;
    return true;
  };

  const answerLater = (jobId: string, stage: HoldStage, held: boolean, delayMs: number, answer: () => void): void => {
    if (held) waiting.push({ jobId, stage, answer });
    else if (delayMs > 0) setTimeout(answer, delayMs);
    else answer();
  };

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? "/", "http://stub");
    const route = `${request.method ?? "GET"} ${url.pathname}`;
    if (route === "GET /health") {
      send(response, 200, { status: "ok" });
    } else if (route === "POST /work") {
      const body = await bodyOf(request);
      const call: WorkCall = {
        callId: work.length + 1,
        jobId: textOf(body["jobId"], "jobId"),
        executionId: textOf(body["executionId"], "executionId"),
        rootExecutionId: textOf(body["rootExecutionId"], "rootExecutionId"),
        instanceId: textOf(body["instanceId"], "instanceId"),
        pod: textOf(body["pod"], "pod"),
        token: numberOf(body["token"], "token"),
        receivedAt: now(),
        held: false,
      };
      call.held = takeHold(call.jobId, "work");
      work.push(call);
      answerLater(call.jobId, "work", call.held, numberOf(body["durationMs"], "durationMs"), () => {
        call.answeredAt = now();
        send(response, 200, { jobId: call.jobId, callId: call.callId });
      });
    } else if (route === "POST /ledger") {
      const body = await bodyOf(request);
      const idempotencyKey = textOf(request.headers["idempotency-key"], "Idempotency-Key");
      const jobId = textOf(body["jobId"], "jobId");
      const first = entries.find((entry) => entry.idempotencyKey === idempotencyKey);
      const entry: LedgerEntry = first ?? {
        entryId: `entry-${String(entries.length + 1)}`,
        jobId,
        idempotencyKey,
        deliveredBy: textOf(body["deliveredBy"], "deliveredBy"),
        appliedAt: now(),
      };
      if (first === undefined) entries.push(entry);
      // applied first, then (maybe) held: a crash after the external effect, before its answer
      const held = takeHold(jobId, "ledger");
      ledgerRequests.push({ jobId, idempotencyKey, pod: textOf(body["pod"], "pod"), receivedAt: now(), isRepeat: first !== undefined, held });
      answerLater(jobId, "ledger", held, 0, () => {
        send(response, 200, entry);
      });
    } else if (route === "GET /ledger") {
      const jobId = url.searchParams.get("jobId") ?? "";
      const entry = entries.find((candidate) => candidate.jobId === jobId);
      if (entry === undefined) send(response, 404, { error: "not-found" });
      else send(response, 200, entry);
    } else if (route === "POST /control/holds") {
      const body = await bodyOf(request);
      const stage = textOf(body["stage"], "stage");
      if (stage !== "work" && stage !== "ledger") throw new Error("stage: work or ledger");
      holds.push({ jobId: textOf(body["jobId"], "jobId"), stage, times: numberOf(body["times"] ?? 1, "times") });
      send(response, 200, { holds });
    } else if (route === "POST /control/release") {
      const body = await bodyOf(request);
      const jobId = textOf(body["jobId"], "jobId");
      const stage = textOf(body["stage"], "stage");
      const released = waiting.filter((one) => one.jobId === jobId && one.stage === stage);
      for (const one of released) {
        waiting.splice(waiting.indexOf(one), 1);
        one.answer();
      }
      send(response, 200, { released: released.length });
    } else if (route === "GET /control/state") {
      send(response, 200, { work, ledgerRequests, entries } satisfies StubState);
    } else {
      send(response, 404, { error: "not-found" });
    }
  }

  const server = createServer((request, response) => {
    handle(request, response).catch((error: unknown) => {
      send(response, 400, { error: error instanceof Error ? error.message : String(error) });
    });
  });
  await new Promise<void>((resolve) => {
    server.listen(port, host, resolve);
  });
  const { port: bound } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${String(bound)}`,
    server,
    state: () => structuredClone({ work, ledgerRequests, entries }),
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => {
          resolve();
        });
      }),
  };
}
