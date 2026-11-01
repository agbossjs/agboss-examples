/**
 * The shapes of the stub gateway: a fictional payment gateway that imitates no real gateway's API
 * or name. What it offers is set by its level, what goes wrong by its faults, and what it did is in
 * its records — the only source of every number this example prints.
 */

/** What the stub offers (Wiki → Payment scenarios → PS6). */
export enum StubLevel {
  /** A key on every request, a lookup by reference, a retention, a conflict, webhooks. */
  Full = "full",
  /** Keys, but no `GET /v1/charges?reference=`: a lost answer can only be replayed. */
  NoLookup = "no-lookup",
  /** The `Idempotency-Key` header is ignored: every request is new (unsupported, PS6). */
  NoKeys = "no-keys",
}

/** A failure the stub injects into the next request(s) of one operation. */
export enum StubFault {
  /** Processes the request, then destroys the socket: the client sees a network error. */
  AnswerThenDrop = "answer-then-drop",
  /** Answers `503` before processing: nothing is recorded, the key is not kept. */
  FailBeforeProcessing = "fail-before-processing",
  /** Processes the request, then answers `502` (a proxy in front of the gateway, #657). */
  ServerErrorAfterProcessing = "server-error-after-processing",
  /** Processes the request and holds its answer until `release()`: a crash after the send. */
  HoldAnswer = "hold-answer",
  /** Holds the request before processing until `release()` (the key is in progress meanwhile). */
  HoldRequest = "hold-request",
}

/** The operations that move money (each takes its own `Idempotency-Key`). */
export type StubOperation = "charge" | "confirm" | "capture" | "refund" | "void";

export type ChargeStatus =
  | "requires_action"
  | "authorized"
  | "succeeded"
  | "declined"
  | "voided"
  | "refunded";

/** What `POST /v1/charges` takes. */
export interface CreateChargeRequest {
  readonly amountCents: number;
  readonly currency: string;
  readonly reference: string;
  /** `false`: authorize only, captured later (PS18, PS20). */
  readonly capture: boolean;
  /** `card_ok`, `card_3ds` (requires a confirm, PS21) or `card_declined` (PS22). */
  readonly paymentMethod: string;
}

/** A charge as the stub answers it. */
export interface StubCharge {
  readonly chargeId: string;
  readonly status: ChargeStatus;
  readonly amountCents: number;
  readonly capturedCents: number;
  readonly refundedCents: number;
  readonly reference: string;
}

/** A capture, a refund or a void as the stub answers it. */
export interface StubMovement {
  readonly id: string;
  readonly chargeId: string;
  readonly amountCents: number;
  readonly status: "succeeded";
}

/** One entry of the stub's records: one movement of money it carried out. */
export interface LedgerEntry {
  readonly id: string;
  readonly chargeId: string;
  readonly amountCents: number;
  readonly reference: string;
  /** The key it was sent with (`undefined`: none, or ignored at `NoKeys`). */
  readonly idempotencyKey: string | undefined;
  /** The stub's time (the scenario's clock), ms since the epoch. */
  readonly at: number;
}

/** Everything the stub carried out, by kind. */
export interface StubLedger {
  readonly charges: readonly LedgerEntry[];
  readonly confirms: readonly LedgerEntry[];
  readonly captures: readonly LedgerEntry[];
  readonly refunds: readonly LedgerEntry[];
  readonly voids: readonly LedgerEntry[];
}

/** One request the stub received, replays and refusals included. */
export interface StubRequest {
  readonly method: string;
  readonly path: string;
  readonly operation: StubOperation | "read" | "lookup" | "webhook";
  readonly idempotencyKey: string | undefined;
  /** What the stub did with it. */
  readonly outcome:
    | "processed"
    | "replayed"
    | "conflict"
    | "in-progress"
    | "refused"
    | "failed-before-processing"
    | "not-supported"
    | "read";
  readonly at: number;
}

/** The money of one reference (an order), from the records. */
export interface StubMoney {
  /** Charges the stub made for it (authorized or captured), in cents. */
  readonly charged: number;
  /** Captured, in cents (an immediate capture counts). */
  readonly captured: number;
  readonly refunded: number;
  /** How many charges, captures, refunds, voids and confirms. */
  readonly charges: number;
  readonly captures: number;
  readonly refunds: number;
  readonly voids: number;
  readonly confirms: number;
}

/** A webhook event the stub sends (`Stub-Signature`: HMAC-SHA256 of the raw body). */
export interface StubEvent {
  readonly eventId: string;
  readonly type: "charge.authorized" | "charge.succeeded" | "refund.succeeded";
  readonly chargeId: string;
  readonly reference: string;
  readonly created: number;
}

/** How the stub is set up for one scenario. */
export interface StubSettings {
  readonly level: StubLevel;
  /** The scenario's clock (its `VirtualClock`): keys expire on it. */
  readonly now: () => number;
  /** How long a key is kept, ms (default 24 h). */
  readonly keyRetention?: number;
  /** How long a new charge stays out of `GET ?reference=`, ms (default 0). */
  readonly lookupLag?: number;
  /** Whether `GET ?reference=` answers (default: at `Full` only; PS23 keeps it at `NoKeys`). */
  readonly lookup?: boolean;
}
