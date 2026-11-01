import { StubKit, fieldText, type KeyPolicy, type StubAnswer, type StubRequest, type StubRoute } from "../../../stub-kit/stub-kit.js";

/**
 * A local stub of the Stripe API v1 — PaymentIntents, Refunds, search — following Stripe's public
 * docs as read on 2026-11-01. Independent example, not affiliated: Stripe is named only to identify
 * its public API; it is not Stripe's server and imitates only what the docs say. Each behaviour
 * cites its page.
 */

const HOUR = 60 * 60 * 1000;

/** How far the search lags behind a new PaymentIntent here (docs: "less than a minute", up to an hour in outages). */
export const STRIPE_SEARCH_LAG = 2 * 60 * 1000;

/**
 * https://docs.stripe.com/api/idempotent_requests (2026-11-01): "For API v1, all POST requests
 * accept idempotency keys." "Stripe saves the status code and body of the first request made with a
 * given idempotency key after endpoint execution begins. Retries with the same key return the saved
 * response, including 500 errors." "The idempotency layer compares incoming parameters to those of
 * the original request and errors if they're not the same."
 * https://docs.stripe.com/error-low-level#idempotency: "Stripe retains keys for at least 24 hours"
 * (24 h here, the documented minimum); "look for the header Idempotent-Replayed: true"; "If a 409
 * indicates that another request with the same key is still executing, wait and retry".
 */
const KEYS: KeyPolicy = {
  keyOf: (request) => header(request, "idempotency-key"),
  retention: 24 * HOUR,
  keeps: () => true,
  // UNVERIFIED: the docs name the error type, `idempotency_error`, not its HTTP status — 400 here
  conflict: { status: 400, body: { error: { type: "idempotency_error", message: "Keys for idempotent requests can only be used with the same parameters they were first used with." } } },
  inProgress: { status: 409, body: { error: { type: "idempotency_error", message: "There is currently another in-progress request using this Idempotent Key." } } },
  repeat: (kept) => ({ ...kept, headers: { ...kept.headers, "idempotent-replayed": "true" } }),
};

interface Intent {
  readonly id: string;
  readonly amount: number;
  readonly orderId: string;
  readonly created: number;
  status: string;
  refunded: number;
  readonly refunds: { id: string; amount: number; payment_intent: string; status: string }[];
}

function header(request: StubRequest, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === "string" ? value : undefined;
}

const intentBody = (intent: Intent) => ({
  id: intent.id,
  object: "payment_intent",
  amount: intent.amount,
  currency: "usd",
  status: intent.status,
  metadata: { order_id: intent.orderId },
  created: Math.floor(intent.created / 1000),
});

/**
 * The order ids a search query names: `metadata['order_id']:'<value>'` clauses joined by `OR`, a
 * value's quote and backslash escaped by a backslash — https://docs.stripe.com/search (2026-11-01):
 * "You can escape quotes inside of quotes with a backslash". An unescaped quote ends the value, so
 * an id that is not escaped can add a clause of its own.
 */
export function orderIdsOf(query: string): string[] {
  const ids: string[] = [];
  const clause = /metadata\['order_id'\]:'((?:[^'\\]|\\.)*)'/gu;
  for (const [, raw] of query.matchAll(clause)) if (raw !== undefined) ids.push(raw.replaceAll(/\\(.)/gu, "$1"));
  return ids;
}

const error = (status: number, type: string, message: string): StubAnswer => ({ status, body: { error: { type, message } } });

/** Starts the Stripe stub: its routes over the shared stub kit. */
export async function startStripeStub(): Promise<StubKit> {
  const intents = new Map<string, Intent>();
  const counter = { next: 0 };
  const box: { kit?: StubKit } = {};
  const kit = (): StubKit => {
    if (box.kit === undefined) throw new Error("the Stripe stub is not started");
    return box.kit;
  };
  const routes = (request: StubRequest): StubRoute | undefined => {
    const { method, path } = request;
    if (method === "POST" && path === "/v1/payment_intents")
      return {
        operation: "charge",
        key: KEYS,
        handle: ({ body }) => {
          const amount = Number(body["amount"]);
          const orderId = fieldText((body["metadata"] as Record<string, unknown> | undefined)?.["order_id"]);
          if (!Number.isInteger(amount) || amount <= 0) return error(400, "invalid_request_error", "Invalid integer: amount");
          counter.next += 1;
          const manual = body["capture_method"] === "manual";
          const intent: Intent = { id: `pi_${String(counter.next)}`, amount, orderId, created: kit().now(), status: manual ? "requires_capture" : "succeeded", refunded: 0, refunds: [] };
          intents.set(intent.id, intent);
          kit().record({ kind: "charge", reference: orderId, amountCents: amount, key: header(request, "idempotency-key") });
          return { status: 200, body: intentBody(intent) };
        },
      };
    // https://docs.stripe.com/api/payment_intents/search: "Don't use search in read-after-write flows
    // where strict consistency is necessary. Under normal operating conditions, data is searchable in
    // less than a minute." — a new PaymentIntent is missing from it for STRIPE_SEARCH_LAG here
    if (method === "GET" && path === "/v1/payment_intents/search")
      return {
        operation: "search",
        handle: ({ query }) => {
          const orderIds = orderIdsOf(query.get("query") ?? "");
          const data = [...intents.values()].filter((intent) => orderIds.includes(intent.orderId) && intent.created + STRIPE_SEARCH_LAG <= kit().now());
          return { status: 200, body: { object: "search_result", url: path, has_more: false, data: data.map(intentBody) } };
        },
      };
    // https://docs.stripe.com/api/refunds/create: "You can optionally refund only part of a charge. You
    // can do so multiple times, until the entire charge has been refunded." … "raise an error when …
    // trying to refund more money than is left on a charge."
    if (method === "POST" && path === "/v1/refunds")
      return {
        operation: "refund",
        key: KEYS,
        handle: ({ body }) => {
          const intent = intents.get(String(body["payment_intent"]));
          const amount = Number(body["amount"]);
          if (intent === undefined) return error(404, "invalid_request_error", "No such payment_intent");
          if (intent.refunded + amount > intent.amount) return error(400, "invalid_request_error", "Refund amount is greater than unrefunded amount on charge");
          intent.refunded += amount;
          counter.next += 1;
          const refund = { id: `re_${String(counter.next)}`, object: "refund", amount, payment_intent: intent.id, status: "succeeded" };
          intent.refunds.push(refund);
          kit().record({ kind: "refund", reference: intent.orderId, amountCents: amount, key: header(request, "idempotency-key") });
          return { status: 200, body: refund };
        },
      };
    // https://docs.stripe.com/api/refunds/list: "payment_intent … Only return refunds for the PaymentIntent specified by this ID."
    if (method === "GET" && path === "/v1/refunds")
      return {
        operation: "refunds.list",
        handle: ({ query }) => ({
          status: 200,
          body: { object: "list", url: path, has_more: false, data: intents.get(query.get("payment_intent") ?? "")?.refunds ?? [] },
        }),
      };
    return undefined;
  };
  box.kit = await StubKit.start(routes);
  const reset = box.kit.reset.bind(box.kit);
  box.kit.reset = (now) => {
    intents.clear();
    counter.next = 0;
    reset(now);
  };
  return box.kit;
}
