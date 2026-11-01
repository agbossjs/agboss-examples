import { generate } from "selfsigned";
import { StubKit, type KeyPolicy, type StubAnswer, type StubRequest, type StubRoute } from "../../../stub-kit/stub-kit.js";

/**
 * A local stub of PayPal's REST API v2 — OAuth, Orders v2, the refund of Payments v2 — served over
 * TLS under a certificate generated when it starts (no key is committed), following PayPal's public
 * docs as read on 2026-11-01. Independent example, not affiliated: PayPal is named only to identify
 * its public API; this is not PayPal's server and imitates only what the docs say. Each behaviour
 * cites its page.
 */

/** The host PayPal's SDK names (its sandbox): the stub's certificate is issued for it. */
export const PAYPAL_SANDBOX_HOST = "api-m.sandbox.paypal.com";

const header = (request: StubRequest): string | undefined => {
  const key = request.headers["paypal-request-id"];
  return typeof key === "string" ? key : undefined;
};

interface Order {
  readonly id: string;
  readonly referenceId: string;
  readonly value: number;
  status: "APPROVED" | "COMPLETED";
  readonly captures: { id: string; status: string; amount: { currency_code: string; value: string } }[];
  readonly refunds: { id: string; status: string; amount: { currency_code: string; value: string } }[];
}

const money = (cents: number) => ({ currency_code: "USD", value: (cents / 100).toFixed(2) });

const orderBody = (order: Order) => ({
  id: order.id,
  intent: "CAPTURE",
  status: order.status,
  purchase_units: [{ reference_id: order.referenceId, amount: money(order.value), payments: { captures: order.captures, refunds: order.refunds } }],
});

const unprocessable = (issue: string): StubAnswer => ({ status: 422, body: { name: "UNPROCESSABLE_ENTITY", details: [{ issue }] } });

/** Starts the PayPal stub over TLS; its certificate (PEM), which the SDK's agent trusts. */
export async function startPayPalStub(): Promise<{ stub: StubKit; certificate: string }> {
  const pems = await generate([{ name: "commonName", value: PAYPAL_SANDBOX_HOST }], {
    keySize: 2048,
    algorithm: "sha256",
    extensions: [{ name: "subjectAltName", altNames: [{ type: 2, value: PAYPAL_SANDBOX_HOST }] }],
  });
  const orders = new Map<string, Order>();
  const counter = { next: 0 };
  const box: { kit?: StubKit } = {};
  const kit = (): StubKit => {
    if (box.kit === undefined) throw new Error("the PayPal stub is not started");
    return box.kit;
  };
  const next = (prefix: string): string => {
    counter.next += 1;
    return `${prefix}${String(counter.next).padStart(6, "0")}`;
  };
  /**
   * https://developer.paypal.com/api/rest/reference/idempotency/ (2026-11-01): "use the
   * PayPal-Request-Id request header"; "PayPal returns the latest status of the previous request that
   * used that same header" — "the status of a request at the current time and not the status of the
   * original request". Retention: Orders 6 h — stated in PayPal's GitHub spec
   * (paypal/paypal-rest-api-specifications, checkout_orders_v2.json v2.32) and the SDK's docstring
   * only: "The server stores keys for 6 hours." Payments v2: not documented (UNVERIFIED) — 6 h here.
   * The same id with another body: not documented (UNVERIFIED).
   */
  const keysOf = (current: (request: StubRequest, kept: StubAnswer) => StubAnswer, inProgress?: StubAnswer): KeyPolicy => ({
    keyOf: header,
    retention: 6 * 60 * 60 * 1000,
    keeps: (answer) => answer.status < 300,
    repeat: (kept, request) => current(request, kept),
    ...(inProgress === undefined ? {} : { inProgress }),
  });
  const orderOf = (path: string): Order | undefined => orders.get(/^\/v2\/checkout\/orders\/([^/]+)/u.exec(path)?.[1] ?? "");
  const currentOrder = (request: StubRequest, kept: StubAnswer): StubAnswer => {
    const order = orderOf(request.path) ?? orders.get(String((kept.body as { id?: unknown }).id));
    return order === undefined ? kept : { status: kept.status, body: orderBody(order) };
  };
  const routes = (request: StubRequest): StubRoute | undefined => {
    const { method, path } = request;
    if (method === "POST" && path === "/v1/oauth2/token")
      return { operation: "token", handle: () => ({ status: 200, body: { access_token: "offline-access-token", token_type: "Bearer", expires_in: 32_400 } }) };
    // Orders v2 create: no money moves; the stub approves the order at once (no buyer here)
    if (method === "POST" && path === "/v2/checkout/orders")
      return {
        operation: "create-order",
        key: keysOf(currentOrder),
        handle: ({ body }) => {
          const unit = (body["purchase_units"] as { reference_id?: string; amount?: { value?: string } }[] | undefined)?.[0];
          const order: Order = { id: next("ORDER"), referenceId: unit?.reference_id ?? "", value: Math.round(Number(unit?.amount?.value) * 100), status: "APPROVED", captures: [], refunds: [] };
          orders.set(order.id, order);
          return { status: 201, body: orderBody(order) };
        },
      };
    if (method === "GET" && /^\/v2\/checkout\/orders\/[^/]+$/u.test(path))
      return { operation: "get-order", handle: () => { const order = orderOf(path); return order === undefined ? { status: 404, body: { name: "RESOURCE_NOT_FOUND" } } : { status: 200, body: orderBody(order) }; } };
    // Orders v2 capture: the money moves here. A second capture under another id: 422
    // ORDER_ALREADY_CAPTURED (https://developer.paypal.com/docs/api/orders/v2/, its errors)
    if (method === "POST" && /^\/v2\/checkout\/orders\/[^/]+\/capture$/u.test(path))
      return {
        operation: "capture",
        key: keysOf(currentOrder),
        handle: (req) => {
          const order = orderOf(path);
          if (order === undefined) return { status: 404, body: { name: "RESOURCE_NOT_FOUND" } };
          if (order.status === "COMPLETED") return unprocessable("ORDER_ALREADY_CAPTURED");
          order.status = "COMPLETED";
          order.captures.push({ id: next("CAPTURE"), status: "COMPLETED", amount: money(order.value) });
          kit().record({ kind: "charge", reference: order.referenceId, amountCents: order.value, key: header(req) });
          return { status: 201, body: orderBody(order) };
        },
      };
    // Payments v2 refund: "409 … PREVIOUS_REQUEST_IN_PROGRESS" on a concurrent request (its schema's examples)
    const refund = /^\/v2\/payments\/captures\/([^/]+)\/refund$/u.exec(path);
    if (method === "POST" && refund?.[1] !== undefined)
      return {
        operation: "refund",
        key: keysOf((_request, kept) => kept, { status: 409, body: { name: "RESOURCE_CONFLICT", details: [{ issue: "PREVIOUS_REQUEST_IN_PROGRESS" }] } }),
        handle: (req) => {
          const order = [...orders.values()].find((candidate) => candidate.captures.some((capture) => capture.id === refund[1]));
          const value = Math.round(Number((req.body["amount"] as { value?: string } | undefined)?.value) * 100);
          if (order === undefined) return { status: 404, body: { name: "RESOURCE_NOT_FOUND" } };
          const refunded = order.refunds.reduce((sum, item) => sum + Math.round(Number(item.amount.value) * 100), 0);
          if (refunded + value > order.value) return unprocessable("REFUND_AMOUNT_EXCEEDED");
          const item = { id: next("REFUND"), status: "COMPLETED", amount: money(value) };
          order.refunds.push(item);
          kit().record({ kind: "refund", reference: order.referenceId, amountCents: value, key: header(req) });
          return { status: 201, body: item };
        },
      };
    return undefined;
  };
  box.kit = await StubKit.start(routes, { key: pems.private, cert: pems.cert });
  const reset = box.kit.reset.bind(box.kit);
  box.kit.reset = (now) => {
    orders.clear();
    counter.next = 0;
    reset(now);
  };
  return { stub: box.kit, certificate: pems.cert };
}
