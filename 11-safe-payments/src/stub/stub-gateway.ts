import { createHmac, randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import {
  StubFault,
  StubLevel,
  type ChargeStatus,
  type CreateChargeRequest,
  type LedgerEntry,
  type StubCharge,
  type StubEvent,
  type StubLedger,
  type StubMoney,
  type StubMovement,
  type StubOperation,
  type StubRequest,
  type StubSettings,
} from "./stub-gateway.types.js";

/**
 * The stub gateway: a fictional payment gateway on `127.0.0.1`, an ephemeral port, served by
 * `node:http`. It imitates no real gateway's API or name — it is the principle (Wiki → Payments),
 * at three support levels, with real failures injected and its own records as the proof.
 *
 * Copy `src/stub/` into your project to check your own gateway call against it, and keep it in
 * line with your gateway's documentation (its key retention, its answer to a repeat, its conflict,
 * its lookup): README → "Check your own gateway call".
 */

const DAY = 24 * 60 * 60 * 1000;
/** The signature header of a webhook: `sha256=<hex HMAC-SHA256 of the raw body>`. */
export const SIGNATURE_HEADER = "stub-signature";
export const REPLAYED_HEADER = "idempotent-replayed";

/** What one answer is: an HTTP status and a JSON body. */
interface Answer {
  readonly status: number;
  readonly body: unknown;
}

/** A key the stub keeps: the request it was first sent with and its answer once processed. */
interface KeptKey {
  readonly fingerprint: string;
  readonly createdAt: number;
  answer?: Answer;
}

/** A charge's state machine (void only before capture, captures up to the authorized amount). */
interface ChargeState {
  readonly chargeId: string;
  readonly reference: string;
  readonly amountCents: number;
  readonly capture: boolean;
  readonly createdAt: number;
  declined: boolean;
  requiresAction: boolean;
  voided: boolean;
  capturedCents: number;
  refundedCents: number;
  readonly refunds: StubMovement[];
}

/** One injected fault: what, on which operation, how many more times. */
interface InjectedFault {
  readonly fault: StubFault;
  readonly operation: StubOperation;
  times: number;
}

/** A request or an answer held by `HoldRequest` / `HoldAnswer` until `release()`. */
interface Held {
  readonly operation: StubOperation;
  readonly stage: "request" | "answer";
  readonly letGo: () => void;
}

const statusOf = (charge: ChargeState): ChargeStatus => {
  if (charge.declined) return "declined";
  if (charge.requiresAction) return "requires_action";
  if (charge.voided) return "voided";
  if (charge.refundedCents > 0 && charge.refundedCents >= charge.capturedCents) return "refunded";
  if (charge.capturedCents > 0) return "succeeded";
  return "authorized";
};

const viewOf = (charge: ChargeState): StubCharge => ({
  chargeId: charge.chargeId,
  status: statusOf(charge),
  amountCents: charge.amountCents,
  capturedCents: charge.capturedCents,
  refundedCents: charge.refundedCents,
  reference: charge.reference,
});

/** The canonical JSON of a value: keys sorted, so one request is one fingerprint. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const isInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

/** The money-moving routes: `POST /v1/charges` and `POST /v1/charges/:id/<action>`. */
function operationOf(method: string, path: string): { operation: StubOperation; chargeId?: string } | undefined {
  if (method !== "POST") return undefined;
  if (path === "/v1/charges") return { operation: "charge" };
  const match = /^\/v1\/charges\/([^/]+)\/(confirm|captures|refunds|void)$/u.exec(path);
  if (match === null) return undefined;
  const [, chargeId, action] = match;
  const operation: StubOperation =
    action === "confirm" ? "confirm" : action === "captures" ? "capture" : action === "refunds" ? "refund" : "void";
  return chargeId === undefined ? undefined : { operation, chargeId: decodeURIComponent(chargeId) };
}

export class StubGateway {
  readonly #server: Server;
  readonly baseUrl: string;
  /** The per-run secret webhooks are signed with. */
  readonly webhookSecret: string = randomBytes(24).toString("hex");
  #settings: Required<StubSettings>;
  #keys = new Map<string, KeptKey>();
  #charges = new Map<string, ChargeState>();
  #ledger: { [K in keyof StubLedger]: LedgerEntry[] } = emptyLedger();
  #requests: StubRequest[] = [];
  #faults: InjectedFault[] = [];
  #held: Held[] = [];
  #sequence = 0;

  private constructor(server: Server, baseUrl: string, settings: StubSettings) {
    this.#server = server;
    this.baseUrl = baseUrl;
    this.#settings = settingsOf(settings);
  }

  /** Starts a stub on `127.0.0.1`, an ephemeral port. */
  static async start(settings: StubSettings = { level: StubLevel.Full, now: () => 0 }): Promise<StubGateway> {
    const started: { gateway?: StubGateway } = {};
    const server = createServer((request, response) => {
      void started.gateway?.handle(request, response);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    started.gateway = new StubGateway(server, `http://127.0.0.1:${String(port)}`, settings);
    return started.gateway;
  }

  /** Forgets everything — keys, charges, records, faults, held requests — and takes new settings. */
  reset(settings: StubSettings): void {
    this.release();
    this.#settings = settingsOf(settings);
    this.#keys = new Map();
    this.#charges = new Map();
    this.#ledger = emptyLedger();
    this.#requests = [];
    this.#faults = [];
    this.#sequence = 0;
  }

  get level(): StubLevel {
    return this.#settings.level;
  }

  /** Injects `fault` into the next `times` requests of `operation` (default once). */
  inject(fault: StubFault, options: { readonly operation: StubOperation; readonly times?: number }): void {
    this.#faults.push({ fault, operation: options.operation, times: options.times ?? 1 });
  }

  /** How many requests or answers are held now. */
  get heldCount(): number {
    return this.#held.length;
  }

  /** Lets every held request and answer go. */
  release(): void {
    for (const held of this.#held.splice(0)) held.letGo();
  }

  /** Every movement of money the stub carried out. */
  ledger(): StubLedger {
    return {
      charges: [...this.#ledger.charges],
      confirms: [...this.#ledger.confirms],
      captures: [...this.#ledger.captures],
      refunds: [...this.#ledger.refunds],
      voids: [...this.#ledger.voids],
    };
  }

  /** Every request received, replays and refusals included. */
  get requests(): readonly StubRequest[] {
    return [...this.#requests];
  }

  /** The charges of one reference, as `GET` shows them now. */
  chargesOf(reference: string): readonly StubCharge[] {
    return [...this.#charges.values()].filter((charge) => charge.reference === reference).map(viewOf);
  }

  /** The money of one reference (an order), from the records. */
  moneyFor(reference: string): StubMoney {
    const charges = [...this.#charges.values()].filter((charge) => charge.reference === reference);
    const count = (entries: readonly LedgerEntry[]): number =>
      entries.filter((entry) => entry.reference === reference).length;
    return {
      charged: this.#ledger.charges
        .filter((entry) => entry.reference === reference)
        .reduce((sum, entry) => sum + entry.amountCents, 0),
      captured: charges.reduce((sum, charge) => sum + charge.capturedCents, 0),
      refunded: charges.reduce((sum, charge) => sum + charge.refundedCents, 0),
      charges: count(this.#ledger.charges),
      captures: count(this.#ledger.captures),
      refunds: count(this.#ledger.refunds),
      voids: count(this.#ledger.voids),
      confirms: count(this.#ledger.confirms),
    };
  }

  /**
   * Posts each event, signed, to `to` — `times` copies of one event at once (a duplicate), the
   * events one after the other in the order given (give them reversed for PS16). The receivers'
   * HTTP statuses, in order.
   */
  async deliver(
    events: readonly StubEvent[],
    options: { readonly to: string; readonly times?: number },
  ): Promise<number[]> {
    const statuses: number[] = [];
    for (const event of events) {
      const body = JSON.stringify(event);
      const signature = `sha256=${createHmac("sha256", this.webhookSecret).update(body).digest("hex")}`;
      const copies = Array.from({ length: options.times ?? 1 }, () =>
        fetch(options.to, {
          method: "POST",
          headers: { "content-type": "application/json", [SIGNATURE_HEADER]: signature },
          body,
        }).then(async (response) => {
          await response.arrayBuffer();
          return response.status;
        }),
      );
      statuses.push(...(await Promise.all(copies)));
    }
    return statuses;
  }

  /** The event for a charge, as the stub would send it. */
  eventFor(type: StubEvent["type"], chargeId: string): StubEvent {
    const charge = this.#charges.get(chargeId);
    if (charge === undefined) throw new Error(`the stub has no charge ${chargeId}`);
    this.#sequence += 1;
    return {
      eventId: `evt_${String(this.#sequence)}`,
      type,
      chargeId,
      reference: charge.reference,
      created: this.#settings.now(),
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

  // ---------------------------------------------------------------------------------------------

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? "/", this.baseUrl);
    const method = request.method ?? "GET";
    const raw = await bodyOf(request);
    const route = operationOf(method, url.pathname);
    if (route === undefined) {
      this.read(method, url, response);
      return;
    }
    const at = this.#settings.now();
    const headerKey = request.headers["idempotency-key"];
    const key =
      this.#settings.level === StubLevel.NoKeys || typeof headerKey !== "string" ? undefined : headerKey;
    const record = (outcome: StubRequest["outcome"]): void => {
      this.#requests.push({ method, path: url.pathname, operation: route.operation, idempotencyKey: typeof headerKey === "string" ? headerKey : undefined, outcome, at });
    };
    const fault = this.takeFault(route.operation);
    if (fault === StubFault.FailBeforeProcessing) {
      record("failed-before-processing");
      send(response, { status: 503, body: { error: "unavailable" } });
      return;
    }
    let body: unknown;
    try {
      body = raw === "" ? {} : JSON.parse(raw);
    } catch {
      record("refused");
      send(response, { status: 400, body: { error: "invalid_json" } });
      return;
    }
    const fingerprint = `${method} ${url.pathname} ${canonical(body)}`;
    let answer: Answer;
    let replayed = false;
    const kept = key === undefined ? undefined : this.keptKey(key);
    if (key !== undefined && kept !== undefined) {
      if (kept.fingerprint !== fingerprint) {
        record("conflict");
        answer = { status: 409, body: { error: "idempotency_conflict" } };
      } else if (kept.answer === undefined) {
        record("in-progress");
        answer = { status: 409, body: { error: "in_progress" } };
      } else {
        record("replayed");
        answer = kept.answer;
        replayed = true;
      }
    } else {
      const entry: KeptKey = { fingerprint, createdAt: at };
      if (key !== undefined) this.#keys.set(key, entry);
      if (fault === StubFault.HoldRequest) await this.hold(route.operation, "request");
      answer = this.process(route.operation, route.chargeId, body, key);
      record(answer.status < 300 || answer.status === 402 ? "processed" : "refused");
      // the first answer is kept and replayed for the same key and request (G4); a refusal of the
      // request itself (a 4xx that moved nothing) is not, so the request can be corrected and sent
      if (key !== undefined) {
        if (answer.status < 300 || answer.status === 402) entry.answer = answer;
        else this.#keys.delete(key);
      }
    }
    if (fault === StubFault.AnswerThenDrop) {
      request.socket.destroy();
      return;
    }
    if (fault === StubFault.ServerErrorAfterProcessing) {
      send(response, { status: 502, body: { error: "bad_gateway" } });
      return;
    }
    if (fault === StubFault.HoldAnswer) await this.hold(route.operation, "answer");
    send(response, answer, replayed ? { [REPLAYED_HEADER]: "true" } : {});
  }

  /** A kept key, or none once its retention passed on the scenario's clock (it is forgotten). */
  private keptKey(key: string): KeptKey | undefined {
    const kept = this.#keys.get(key);
    if (kept === undefined) return undefined;
    if (this.#settings.now() - kept.createdAt >= this.#settings.keyRetention) {
      this.#keys.delete(key);
      return undefined;
    }
    return kept;
  }

  private takeFault(operation: StubOperation): StubFault | undefined {
    const found = this.#faults.find((fault) => fault.operation === operation && fault.times > 0);
    if (found === undefined) return undefined;
    found.times -= 1;
    return found.fault;
  }

  private hold(operation: StubOperation, stage: Held["stage"]): Promise<void> {
    return new Promise((resolve) => this.#held.push({ operation, stage, letGo: resolve }));
  }

  private nextId(prefix: string): string {
    this.#sequence += 1;
    return `${prefix}_${String(this.#sequence)}`;
  }

  private entry(chargeId: string, reference: string, amountCents: number, key: string | undefined, prefix: string): LedgerEntry {
    return { id: this.nextId(prefix), chargeId, amountCents, reference, idempotencyKey: key, at: this.#settings.now() };
  }

  private process(operation: StubOperation, chargeId: string | undefined, body: unknown, key: string | undefined): Answer {
    const fields = (body ?? {}) as Record<string, unknown>;
    if (operation === "charge") return this.createCharge(fields, key);
    const charge = chargeId === undefined ? undefined : this.#charges.get(chargeId);
    if (charge === undefined) return { status: 404, body: { error: "no_such_charge" } };
    switch (operation) {
      case "confirm": {
        if (!charge.requiresAction) return { status: 409, body: { error: "invalid_state", charge: viewOf(charge) } };
        charge.requiresAction = false;
        if (charge.capture) charge.capturedCents = charge.amountCents;
        this.#ledger.confirms.push(this.entry(charge.chargeId, charge.reference, charge.amountCents, key, "cf"));
        this.#ledger.charges.push(this.entry(charge.chargeId, charge.reference, charge.amountCents, key, "ch"));
        return { status: 200, body: viewOf(charge) };
      }
      case "capture": {
        const amountCents = fields["amountCents"];
        if (!isInteger(amountCents)) return { status: 400, body: { error: "invalid_amount" } };
        if (charge.capture || charge.voided || charge.declined || charge.requiresAction)
          return { status: 409, body: { error: "invalid_state", charge: viewOf(charge) } };
        if (charge.capturedCents + amountCents > charge.amountCents)
          return { status: 409, body: { error: "over_capture", charge: viewOf(charge) } };
        charge.capturedCents += amountCents;
        const entry = this.entry(charge.chargeId, charge.reference, amountCents, key, "cp");
        this.#ledger.captures.push(entry);
        return { status: 200, body: { id: entry.id, chargeId: charge.chargeId, amountCents, status: "succeeded" } satisfies StubMovement };
      }
      case "refund": {
        const amountCents = fields["amountCents"];
        if (!isInteger(amountCents)) return { status: 400, body: { error: "invalid_amount" } };
        if (charge.refundedCents + amountCents > charge.capturedCents)
          return { status: 409, body: { error: "over_refund", charge: viewOf(charge) } };
        charge.refundedCents += amountCents;
        const entry = this.entry(charge.chargeId, charge.reference, amountCents, key, "re");
        const movement: StubMovement = { id: entry.id, chargeId: charge.chargeId, amountCents, status: "succeeded" };
        charge.refunds.push(movement);
        this.#ledger.refunds.push(entry);
        return { status: 200, body: movement };
      }
      case "void": {
        if (charge.capture || charge.capturedCents > 0 || charge.voided || charge.declined)
          return { status: 409, body: { error: "invalid_state", charge: viewOf(charge) } };
        charge.voided = true;
        const entry = this.entry(charge.chargeId, charge.reference, charge.amountCents, key, "vd");
        this.#ledger.voids.push(entry);
        return { status: 200, body: { id: entry.id, chargeId: charge.chargeId, amountCents: charge.amountCents, status: "succeeded" } satisfies StubMovement };
      }
    }
  }

  private createCharge(fields: Record<string, unknown>, key: string | undefined): Answer {
    const { amountCents, currency, reference, capture, paymentMethod } = fields as Partial<CreateChargeRequest>;
    if (!isInteger(amountCents) || typeof reference !== "string" || reference === "" || typeof currency !== "string" || typeof capture !== "boolean" || typeof paymentMethod !== "string")
      return { status: 400, body: { error: "invalid_request" } };
    const charge: ChargeState = {
      chargeId: this.nextId("ch"),
      reference,
      amountCents,
      capture,
      createdAt: this.#settings.now(),
      declined: paymentMethod === "card_declined",
      requiresAction: paymentMethod === "card_3ds",
      voided: false,
      capturedCents: 0,
      refundedCents: 0,
      refunds: [],
    };
    this.#charges.set(charge.chargeId, charge);
    if (charge.declined) return { status: 402, body: viewOf(charge) };
    if (!charge.requiresAction) {
      if (capture) charge.capturedCents = amountCents;
      this.#ledger.charges.push(this.entry(charge.chargeId, reference, amountCents, key, "lg"));
    }
    return { status: 200, body: viewOf(charge) };
  }

  /** The reads: a charge by id, its refunds, the lookup by reference (`Full` only). */
  private read(method: string, url: URL, response: ServerResponse): void {
    const at = this.#settings.now();
    const push = (operation: StubRequest["operation"], outcome: StubRequest["outcome"]): void => {
      this.#requests.push({ method, path: url.pathname, operation, idempotencyKey: undefined, outcome, at });
    };
    if (method !== "GET") {
      push("read", "refused");
      send(response, { status: 404, body: { error: "no_such_route" } });
      return;
    }
    if (url.pathname === "/v1/charges") {
      if (!this.#settings.lookup) {
        push("lookup", "not-supported");
        send(response, { status: 404, body: { error: "not_supported" } });
        return;
      }
      const reference = url.searchParams.get("reference") ?? "";
      push("lookup", "read");
      const found = [...this.#charges.values()].filter(
        (charge) => charge.reference === reference && charge.createdAt + this.#settings.lookupLag <= at,
      );
      send(response, { status: 200, body: { data: found.map(viewOf) } });
      return;
    }
    const match = /^\/v1\/charges\/([^/]+)(\/refunds)?$/u.exec(url.pathname);
    const charge = match?.[1] === undefined ? undefined : this.#charges.get(decodeURIComponent(match[1]));
    push("read", "read");
    if (charge === undefined) {
      send(response, { status: 404, body: { error: "no_such_charge" } });
      return;
    }
    send(response, { status: 200, body: match?.[2] === undefined ? viewOf(charge) : { data: [...charge.refunds] } });
  }
}

function settingsOf(settings: StubSettings): Required<StubSettings> {
  return { keyRetention: DAY, lookupLag: 0, lookup: settings.level === StubLevel.Full, ...settings };
}

function emptyLedger(): { [K in keyof StubLedger]: LedgerEntry[] } {
  return { charges: [], confirms: [], captures: [], refunds: [], voids: [] };
}

async function bodyOf(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function send(response: ServerResponse, answer: Answer, headers: Record<string, string> = {}): void {
  if (response.destroyed) return;
  response.writeHead(answer.status, { "content-type": "application/json", ...headers });
  response.end(JSON.stringify(answer.body));
}
