import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import type { AddressInfo } from "node:net";

/**
 * The machinery every gateway stub of this project shares: an HTTP(S) server on `127.0.0.1`, an
 * ephemeral port, the injected faults, the held requests and answers, the idempotency-key store
 * (each gateway says how its keys behave, `KeyPolicy`) and the records — the only source of every
 * number this project prints. What a route does is the gateway's own (`src/gateways/<slug>/stub/`).
 * Not a real gateway's server: each stub follows that gateway's public docs as read on 2026-11-01.
 */

/** A body field as text (`""` when it is not one). */
export const fieldText = (value: unknown): string => (typeof value === "string" ? value : typeof value === "number" ? String(value) : "");

/** A failure injected into the next request(s) of one operation. */
export enum StubFault {
  /** Processes, then destroys the socket: the SDK sees a network error. */
  AnswerThenDrop = "answer-then-drop",
  /** Answers `503` before processing: nothing recorded, the key not kept. */
  FailBeforeProcessing = "fail-before-processing",
  /** Processes, then answers `502` (a proxy in front of the gateway, #657). */
  ServerErrorAfterProcessing = "server-error-after-processing",
  /** Processes and holds the answer until `release()`: a crash after the send. */
  HoldAnswer = "hold-answer",
  /** Holds the request before processing until `release()` (its key in progress meanwhile). */
  HoldRequest = "hold-request",
}

/** A request as a route sees it. */
export interface StubRequest {
  readonly method: string;
  readonly path: string;
  readonly query: URLSearchParams;
  readonly headers: IncomingMessage["headers"];
  /** The body: JSON, or a form (`a=b&metadata[order_id]=42` → `{ a, metadata: { order_id } }`). */
  readonly body: Record<string, unknown>;
}

/** An answer: an HTTP status, a JSON body, headers. */
export interface StubAnswer {
  readonly status: number;
  readonly body: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

/** How a gateway's idempotency keys behave, each from its own docs. */
export interface KeyPolicy {
  /** The key of a request (a header, or a body field), or none. */
  readonly keyOf: (request: StubRequest) => string | undefined;
  /** How long a key is kept, ms (`Infinity`: no documented end). */
  readonly retention: number;
  /** Whether this answer is kept under the key — replayed to a repeat — or forgotten. */
  readonly keeps: (answer: StubAnswer, request: StubRequest) => boolean;
  /** The answer to the same key with another request, or none when the docs say nothing (replayed). */
  readonly conflict?: StubAnswer;
  /** The answer to a repeat while the first is still processed; none: no protection (processed again). */
  readonly inProgress?: StubAnswer;
  /** The answer to a repeat of a kept key (default: the first answer, as kept). */
  readonly repeat?: (kept: StubAnswer, request: StubRequest) => StubAnswer;
}

/** One route: which operation it is, how its key behaves, what it does. */
export interface StubRoute {
  readonly operation: string;
  readonly key?: KeyPolicy;
  readonly handle: (request: StubRequest) => StubAnswer;
}

/** One movement of money the stub carried out. */
export interface Movement {
  readonly kind: "charge" | "capture" | "refund";
  readonly reference: string;
  readonly amountCents: number;
  readonly key: string | undefined;
  readonly at: number;
}

/** One request received, with what was done with it. */
export interface ReceivedRequest {
  readonly operation: string;
  readonly method: string;
  readonly path: string;
  readonly key: string | undefined;
  readonly outcome: "processed" | "replayed" | "conflict" | "in-progress" | "failed-before-processing" | "read";
}

interface Kept {
  readonly fingerprint: string;
  readonly at: number;
  answer?: StubAnswer;
}

/** A stub's money for one reference: what it charged, captured and refunded. */
export interface StubMoney {
  readonly charges: number;
  readonly captures: number;
  readonly refunds: number;
  readonly charged: number;
  readonly captured: number;
  readonly refunded: number;
}

function formOf(text: string): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const [name, value] of new URLSearchParams(text)) {
    const nested = /^([^[]+)\[([^\]]+)\]$/u.exec(name);
    if (nested?.[1] !== undefined && nested[2] !== undefined) {
      const inner = (body[nested[1]] ?? {}) as Record<string, unknown>;
      inner[nested[2]] = value;
      body[nested[1]] = inner;
    } else body[name] = value;
  }
  return body;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

async function textOf(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export class StubKit {
  readonly #server: Server;
  readonly baseUrl: string;
  #now: () => number = () => 0;
  #keys = new Map<string, Kept>();
  #movements: Movement[] = [];
  #requests: ReceivedRequest[] = [];
  #faults: { fault: StubFault; operation: string; times: number }[] = [];
  #held: (() => void)[] = [];

  private constructor(server: Server, baseUrl: string) {
    this.#server = server;
    this.baseUrl = baseUrl;
  }

  /** Starts on `127.0.0.1`, an ephemeral port — over TLS when given a key and a certificate. */
  static async start(
    routeOf: (request: StubRequest) => StubRoute | undefined,
    tls?: { readonly key: string; readonly cert: string },
  ): Promise<StubKit> {
    const started: { kit?: StubKit } = {};
    const listener = (request: IncomingMessage, response: ServerResponse): void => {
      void started.kit?.handle(routeOf, request, response);
    };
    const server = tls === undefined ? createHttpServer(listener) : createHttpsServer(tls, listener);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    started.kit = new StubKit(server, `${tls === undefined ? "http" : "https"}://127.0.0.1:${String(port)}`);
    return started.kit;
  }

  /** Forgets every key, movement, request, fault and hold; reads time from `now` (the scenario's clock). */
  reset(now: () => number): void {
    this.release();
    this.#now = now;
    this.#keys = new Map();
    this.#movements = [];
    this.#requests = [];
    this.#faults = [];
  }

  now(): number {
    return this.#now();
  }

  inject(fault: StubFault, options: { readonly operation: string; readonly times?: number }): void {
    this.#faults.push({ fault, operation: options.operation, times: options.times ?? 1 });
  }

  get heldCount(): number {
    return this.#held.length;
  }

  release(): void {
    for (const letGo of this.#held.splice(0)) letGo();
  }

  /** A route records a movement of money it carried out. */
  record(movement: Omit<Movement, "at">): void {
    this.#movements.push({ ...movement, at: this.#now() });
  }

  get movements(): readonly Movement[] {
    return [...this.#movements];
  }

  get requests(): readonly ReceivedRequest[] {
    return [...this.#requests];
  }

  moneyFor(reference: string): StubMoney {
    const of = (kind: Movement["kind"]) => this.#movements.filter((m) => m.kind === kind && m.reference === reference);
    const sum = (movements: readonly Movement[]) => movements.reduce((total, m) => total + m.amountCents, 0);
    return {
      charges: of("charge").length,
      captures: of("capture").length,
      refunds: of("refund").length,
      charged: sum(of("charge")),
      captured: sum(of("capture")),
      refunded: sum(of("refund")),
    };
  }

  async close(): Promise<void> {
    this.release();
    this.#server.closeAllConnections();
    await new Promise<void>((resolve) => {
      this.#server.close(() => {
        resolve();
      });
    });
  }

  private async handle(
    routeOf: (request: StubRequest) => StubRoute | undefined,
    incoming: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const url = new URL(incoming.url ?? "/", "http://stub");
    const text = await textOf(incoming);
    const isForm = (incoming.headers["content-type"] ?? "").includes("x-www-form-urlencoded");
    let body: Record<string, unknown> = {};
    try {
      body = text === "" ? {} : isForm ? formOf(text) : (JSON.parse(text) as Record<string, unknown>);
    } catch {
      send(response, { status: 400, body: { error: "invalid body" } });
      return;
    }
    const request: StubRequest = { method: incoming.method ?? "GET", path: url.pathname, query: url.searchParams, headers: incoming.headers, body };
    const route = routeOf(request);
    if (route === undefined) {
      send(response, { status: 404, body: { error: `no route ${request.method} ${request.path}` } });
      return;
    }
    const key = route.key?.keyOf(request);
    const note = (outcome: ReceivedRequest["outcome"]): void => {
      this.#requests.push({ operation: route.operation, method: request.method, path: request.path, key, outcome });
    };
    const found = this.#faults.find((candidate) => candidate.operation === route.operation && candidate.times > 0);
    if (found !== undefined) found.times -= 1;
    const fault = found?.fault;
    if (fault === StubFault.FailBeforeProcessing) {
      note("failed-before-processing");
      send(response, { status: 503, body: { error: "service unavailable" } });
      return;
    }
    const policy = route.key;
    const fingerprint = `${request.method} ${request.path} ${canonical(body)}`;
    let answer: StubAnswer;
    const kept = policy === undefined || key === undefined ? undefined : this.kept(key, policy);
    if (policy !== undefined && kept !== undefined && kept.fingerprint !== fingerprint && policy.conflict !== undefined) {
      note("conflict");
      answer = policy.conflict;
    } else if (policy !== undefined && kept !== undefined && kept.answer === undefined && policy.inProgress !== undefined) {
      note("in-progress");
      answer = policy.inProgress;
    } else if (policy !== undefined && kept?.answer !== undefined) {
      note("replayed");
      answer = policy.repeat === undefined ? kept.answer : policy.repeat(kept.answer, request);
    } else {
      const entry: Kept = { fingerprint, at: this.#now() };
      const keyed = policy !== undefined && key !== undefined;
      if (keyed && kept === undefined) this.#keys.set(key, entry);
      if (fault === StubFault.HoldRequest) await this.hold();
      answer = route.handle(request);
      note(request.method === "GET" ? "read" : "processed");
      if (keyed && kept === undefined) {
        if (policy.keeps(answer, request)) entry.answer = answer;
        else this.#keys.delete(key);
      }
    }
    if (fault === StubFault.AnswerThenDrop) {
      incoming.socket.destroy();
      return;
    }
    if (fault === StubFault.ServerErrorAfterProcessing) {
      send(response, { status: 502, body: { error: "bad gateway" } });
      return;
    }
    if (fault === StubFault.HoldAnswer) await this.hold();
    send(response, answer);
  }

  private kept(key: string, policy: KeyPolicy): Kept | undefined {
    const kept = this.#keys.get(key);
    if (kept === undefined) return undefined;
    if (this.#now() - kept.at >= policy.retention) {
      this.#keys.delete(key);
      return undefined;
    }
    return kept;
  }

  private hold(): Promise<void> {
    return new Promise((resolve) => this.#held.push(resolve));
  }
}

function send(response: ServerResponse, answer: StubAnswer): void {
  if (response.destroyed) return;
  response.writeHead(answer.status, { "content-type": "application/json", ...answer.headers });
  response.end(JSON.stringify(answer.body));
}
