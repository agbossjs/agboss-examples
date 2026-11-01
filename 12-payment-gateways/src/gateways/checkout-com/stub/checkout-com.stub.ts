import { StubKit, fieldText, type KeyPolicy, type StubAnswer, type StubRequest, type StubRoute } from "../../../stub-kit/stub-kit.js";

/**
 * A local stub of Checkout.com's Payments API, following its public docs as read on 2026-11-01.
 * Independent example, not affiliated: Checkout.com is named only to identify its public API; this
 * is not its server and imitates only what the docs say. Each behaviour cites its page.
 */

/**
 * https://www.checkout.com/docs/developer-resources/api/idempotency (2026-11-01): the key is the
 * `Cko-Idempotency-Key` header, on payments, captures, refunds and voids; keys expire "after 72 hours
 * for both the sandbox and production environments"; repeats "return the same HTTP status code and
 * response body as the original request"; for a 4xx or 5xx original "we don't save an idempotent
 * result" (a repeat runs again); a concurrent duplicate gets "409 Conflict with another request being
 * processed". A key reused with another body on payments: not documented (UNVERIFIED) — replayed here.
 */
const KEYS: KeyPolicy = {
  keyOf: (request) => {
    const key = request.headers["cko-idempotency-key"];
    return typeof key === "string" ? key : undefined;
  },
  retention: 72 * 60 * 60 * 1000,
  keeps: (answer) => answer.status >= 200 && answer.status < 300,
  inProgress: { status: 409, body: { error_type: "conflict", error_codes: ["Conflict with another request being processed"] } },
};

interface Payment {
  readonly id: string;
  readonly amount: number;
  readonly reference: string;
  readonly capture: boolean;
  captured: number;
  refunded: number;
  readonly actions: { id: string; type: "Authorization" | "Capture" | "Refund"; amount: number; reference: string }[];
}

const body = (payment: Payment) => ({
  id: payment.id,
  action_id: payment.actions[0]?.id,
  amount: payment.amount,
  currency: "USD",
  approved: true,
  status: payment.refunded > 0 ? "Refunded" : payment.captured >= payment.amount ? "Captured" : payment.captured > 0 ? "Partially Captured" : "Authorized",
  reference: payment.reference,
});

const refused = (status: number, code: string): StubAnswer => ({ status, body: { error_type: "request_invalid", error_codes: [code] } });

/** Starts the Checkout.com stub. */
export async function startCheckoutComStub(): Promise<StubKit> {
  const payments = new Map<string, Payment>();
  const counter = { next: 0 };
  const box: { kit?: StubKit } = {};
  const kit = (): StubKit => {
    if (box.kit === undefined) throw new Error("the Checkout.com stub is not started");
    return box.kit;
  };
  const keyOf = (request: StubRequest) => KEYS.keyOf(request);
  const routes = (request: StubRequest): StubRoute | undefined => {
    const { method, path } = request;
    if (method === "POST" && path === "/payments")
      return {
        operation: "charge",
        key: KEYS,
        handle: (req) => {
          const amount = Number(req.body["amount"]);
          const reference = fieldText(req.body["reference"]);
          if (!Number.isInteger(amount) || amount <= 0) return refused(422, "amount_invalid");
          counter.next += 1;
          const capture = req.body["capture"] !== false;
          const payment: Payment = { id: `pay_${String(counter.next)}`, amount, reference, capture, captured: capture ? amount : 0, refunded: 0, actions: [{ id: `act_${String(counter.next)}`, type: "Authorization", amount, reference }] };
          payments.set(payment.id, payment);
          kit().record({ kind: "charge", reference, amountCents: amount, key: keyOf(req) });
          if (capture) kit().record({ kind: "capture", reference, amountCents: amount, key: keyOf(req) });
          return { status: 201, body: body(payment) };
        },
      };
    // https://www.checkout.com/docs/payments/manage-payments/get-a-list-of-payments: `reference` is
    // "The payment reference to search for" — not unique, so the wiring matches the amount too
    if (method === "GET" && path === "/payments")
      return {
        operation: "lookup",
        handle: ({ query }) => {
          const data = [...payments.values()].filter((payment) => payment.reference === query.get("reference")).map(body);
          return { status: 200, body: { limit: 10, skip: 0, total_count: data.length, data } };
        },
      };
    const match = /^\/payments\/([^/]+)(?:\/(captures|refunds|actions))?$/u.exec(path);
    const payment = match?.[1] === undefined ? undefined : payments.get(match[1]);
    if (match === null) return undefined;
    if (method === "GET")
      return {
        operation: match[2] === "actions" ? "actions" : "read",
        handle: () => (payment === undefined ? refused(404, "payment_not_found") : { status: 200, body: match[2] === "actions" ? payment.actions : body(payment) }),
      };
    // https://www.checkout.com/docs/payments/manage-payments/capture-a-payment: "To perform multiple
    // partial captures, set the capture_type field to NonFinal."
    if (method === "POST" && match[2] === "captures")
      return {
        operation: "capture",
        key: KEYS,
        handle: (req) => {
          const amount = Number(req.body["amount"]);
          if (payment === undefined) return refused(404, "payment_not_found");
          if (payment.captured + amount > payment.amount) return refused(422, "amount_exceeds_balance");
          payment.captured += amount;
          counter.next += 1;
          const action = { id: `act_${String(counter.next)}`, type: "Capture" as const, amount, reference: payment.reference };
          payment.actions.push(action);
          kit().record({ kind: "capture", reference: payment.reference, amountCents: amount, key: keyOf(req) });
          return { status: 202, body: { action_id: action.id, reference: payment.reference } };
        },
      };
    // https://www.checkout.com/docs/payments/manage-payments/refund-a-payment/refund-a-payment-with-a-reference:
    // "A payment can be refunded multiple times, but cannot exceed the original payment amount."
    if (method === "POST" && match[2] === "refunds")
      return {
        operation: "refund",
        key: KEYS,
        handle: (req) => {
          const amount = Number(req.body["amount"]);
          if (payment === undefined) return refused(404, "payment_not_found");
          if (payment.refunded + amount > payment.captured) return refused(422, "refund_amount_exceeds_balance");
          payment.refunded += amount;
          counter.next += 1;
          const action = { id: `act_${String(counter.next)}`, type: "Refund" as const, amount, reference: payment.reference };
          payment.actions.push(action);
          kit().record({ kind: "refund", reference: payment.reference, amountCents: amount, key: keyOf(req) });
          return { status: 202, body: { action_id: action.id, reference: payment.reference } };
        },
      };
    return undefined;
  };
  box.kit = await StubKit.start(routes);
  const reset = box.kit.reset.bind(box.kit);
  box.kit.reset = (now) => {
    payments.clear();
    counter.next = 0;
    reset(now);
  };
  return box.kit;
}
