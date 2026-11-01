import type {
  CreateChargeRequest,
  StubCharge,
  StubMovement,
} from "./stub-gateway.types.js";

/**
 * The stub gateway's client: a typed `fetch` client, this example's stand-in for a gateway's SDK.
 * Every money-moving call takes the idempotency key to send (`Idempotency-Key`) — or none, which
 * is what the wrong versions do — and the step's signal.
 */

/** What the stub answered with an error status (or a decline, `402`). */
export class StubGatewayError extends Error {
  static readonly code = "stub-gateway.error";

  constructor(
    readonly status: number,
    readonly error: string,
    readonly body: unknown,
  ) {
    super(`the stub gateway answered ${String(status)} ${error}`);
    this.name = "StubGatewayError";
  }
}

/** Per-request options: the key to send, the step's signal. */
export interface StubCallOptions {
  readonly idempotencyKey?: string;
  readonly signal?: AbortSignal;
}

export class StubGatewayClient {
  constructor(private readonly baseUrl: string) {}

  createCharge(request: CreateChargeRequest, options: StubCallOptions = {}): Promise<StubCharge> {
    return this.post("/v1/charges", request, options);
  }

  confirm(chargeId: string, options: StubCallOptions = {}): Promise<StubCharge> {
    return this.post(`/v1/charges/${encodeURIComponent(chargeId)}/confirm`, {}, options);
  }

  capture(chargeId: string, amountCents: number, options: StubCallOptions = {}): Promise<StubMovement> {
    return this.post(`/v1/charges/${encodeURIComponent(chargeId)}/captures`, { amountCents }, options);
  }

  refund(chargeId: string, amountCents: number, options: StubCallOptions = {}): Promise<StubMovement> {
    return this.post(`/v1/charges/${encodeURIComponent(chargeId)}/refunds`, { amountCents }, options);
  }

  void(chargeId: string, options: StubCallOptions = {}): Promise<StubMovement> {
    return this.post(`/v1/charges/${encodeURIComponent(chargeId)}/void`, {}, options);
  }

  getCharge(chargeId: string, options: StubCallOptions = {}): Promise<StubCharge> {
    return this.get(`/v1/charges/${encodeURIComponent(chargeId)}`, options);
  }

  /** The lookup by your reference (`Full` only; `StubGatewayError` 404 `not_supported` else). */
  async findByReference(reference: string, options: StubCallOptions = {}): Promise<readonly StubCharge[]> {
    const { data } = await this.get<{ data: StubCharge[] }>(
      `/v1/charges?reference=${encodeURIComponent(reference)}`,
      options,
    );
    return data;
  }

  async refundsOf(chargeId: string, options: StubCallOptions = {}): Promise<readonly StubMovement[]> {
    const { data } = await this.get<{ data: StubMovement[] }>(
      `/v1/charges/${encodeURIComponent(chargeId)}/refunds`,
      options,
    );
    return data;
  }

  private async post<T>(path: string, body: unknown, options: StubCallOptions): Promise<T> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (options.idempotencyKey !== undefined) headers["idempotency-key"] = options.idempotencyKey;
    const init: RequestInit = { method: "POST", headers, body: JSON.stringify(body) };
    if (options.signal !== undefined) init.signal = options.signal;
    return answerOf<T>(await fetch(`${this.baseUrl}${path}`, init));
  }

  private async get<T>(path: string, options: StubCallOptions): Promise<T> {
    const init: RequestInit = { method: "GET" };
    if (options.signal !== undefined) init.signal = options.signal;
    return answerOf<T>(await fetch(`${this.baseUrl}${path}`, init));
  }
}

async function answerOf<T>(response: Response): Promise<T> {
  const body: unknown = await response.json();
  if (response.status >= 300) {
    const error = (body as { error?: unknown }).error;
    throw new StubGatewayError(response.status, typeof error === "string" ? error : "declined", body);
  }
  return body as T;
}
