import { StubKit, fieldText, type KeyPolicy, type StubRequest, type StubRoute } from "../../../stub-kit/stub-kit.js";

/**
 * A local stub of CardCom's HTTP API v11 — Do Transaction, the lookup by `ExternalUniqTranId`, the
 * refund by transaction id — following CardCom's public docs as read on 2026-11-01. Independent
 * example, not affiliated: CardCom is named only to identify its public API; this is not CardCom's
 * server and imitates only what the docs say. Each behaviour cites its page.
 */

/**
 * https://secure.cardcom.solutions/api/v11/docs (swagger `TransactionReq.ExternalUniqTranId`,
 * 2026-11-01): "send your uniq trnasaction id to prevent duplication of transaction. if the same
 * ExternalUniqTranId will be send you will receive and error code 608".
 * KB 509 (https://kb.cardcom.solutions/apijosn/he/articles/509/prevent-duplicate-token-transactions):
 * "מחרוזת של עד 25 תווים" ("a string of up to 25 characters"); the id stays valid "until the system
 * answers that a valid response code was received" — a failed attempt does not use it up; and
 * "wait … usually 1 second, but can take up to 7 seconds" — a concurrent duplicate is NOT protected
 * (no in-progress answer: processed again). KB 508 (…/articles/508/do-transaction-token-charge-direct-interface):
 * `ExternalUniqUniqTranIdResponse` "true - לא יחייב את הכרטיס, אבל יחזיר את התגובה המקורית"
 * ("true: it will not charge the card, but returns the original response"); false → error 608.
 * Retention: not documented — kept for as long as the stub runs.
 */
const KEYS: KeyPolicy = {
  keyOf: (request) => {
    const key = request.body["ExternalUniqTranId"];
    return typeof key === "string" && key !== "" ? key : undefined;
  },
  retention: Number.POSITIVE_INFINITY,
  keeps: (answer) => (answer.body as { ResponseCode?: unknown }).ResponseCode === 0,
  repeat: (kept, request) =>
    request.body["ExternalUniqUniqTranIdResponse"] === true
      ? kept
      : { status: 200, body: { ResponseCode: 608, Description: "ExternalUniqTranId already used" } },
};

interface Transaction {
  readonly id: number;
  readonly externalId: string;
  readonly orderId: string;
  readonly amount: number;
  refunded: number;
}

const cents = (amount: unknown): number => Math.round(Number(amount) * 100);

/** Starts the CardCom stub. */
export async function startCardcomStub(): Promise<StubKit> {
  const transactions = new Map<number, Transaction>();
  const counter = { next: 0 };
  const box: { kit?: StubKit } = {};
  const kit = (): StubKit => {
    if (box.kit === undefined) throw new Error("the CardCom stub is not started");
    return box.kit;
  };
  const routes = (request: StubRequest): StubRoute | undefined => {
    if (request.method !== "POST") return undefined;
    switch (request.path) {
      case "/api/v11/Transactions/Transaction":
        return {
          operation: "charge",
          key: KEYS,
          handle: ({ body }) => {
            const externalId = fieldText(body["ExternalUniqTranId"]);
            if (externalId.length > 25) return { status: 200, body: { ResponseCode: 5, Description: "ExternalUniqTranId longer than 25" } };
            counter.next += 1;
            const transaction: Transaction = { id: 100_000 + counter.next, externalId, orderId: fieldText(body["ReturnValue"]), amount: cents(body["Amount"]), refunded: 0 };
            transactions.set(transaction.id, transaction);
            kit().record({ kind: "charge", reference: transaction.orderId, amountCents: transaction.amount, key: externalId });
            return { status: 200, body: { ResponseCode: 0, Description: "OK", TranzactionId: transaction.id, Amount: transaction.amount / 100, ExternalUniqTranId: externalId } };
          },
        };
      // swagger: GetTransactionByExternalUniqTran — "use to validate if there is a successful
      // transaction using the External UniqTranId parameter". Its answer when none: UNVERIFIED
      // (a non-zero ResponseCode here)
      case "/api/v11/Transactions/GetTransactionByExternalUniqTran":
        return {
          operation: "lookup",
          handle: ({ body }) => {
            const found = [...transactions.values()].find((transaction) => transaction.externalId === body["ExternalUniqTranId"]);
            return found === undefined
              ? { status: 200, body: { ResponseCode: 504, Description: "transaction not found" } }
              : { status: 200, body: { ResponseCode: 0, TranzactionInfo: { TranzactionId: found.id, Amount: found.amount / 100 } } };
          },
        };
      // swagger: RefundByTransactionId — `TransactionId`, `PartialSum`, `AllowMultipleRefunds`; no
      // idempotency field ("ExternalRefundDealId" has no documented uniqueness): every request refunds
      case "/api/v11/Transactions/RefundByTransactionId":
        return {
          operation: "refund",
          handle: ({ body }) => {
            const transaction = transactions.get(Number(body["TransactionId"]));
            const amount = cents(body["PartialSum"]);
            if (transaction === undefined) return { status: 200, body: { ResponseCode: 504, Description: "transaction not found" } };
            if (transaction.refunded + amount > transaction.amount) return { status: 200, body: { ResponseCode: 4, Description: "refund above the transaction" } };
            transaction.refunded += amount;
            counter.next += 1;
            kit().record({ kind: "refund", reference: transaction.orderId, amountCents: amount, key: undefined });
            return { status: 200, body: { ResponseCode: 0, Description: "OK", NewTranzactionId: 100_000 + counter.next } };
          },
        };
      default:
        return undefined;
    }
  };
  box.kit = await StubKit.start(routes);
  const reset = box.kit.reset.bind(box.kit);
  box.kit.reset = (now) => {
    transactions.clear();
    counter.next = 0;
    reset(now);
  };
  return box.kit;
}
