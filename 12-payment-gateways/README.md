# `12-payment-gateways` — The Right Wiring on Ten Gateways' Official SDKs

> **Priority:** P0 — the Payments contract, checked gateway by gateway
> **Principle:** Promise → Failure Injection → Reproducible Proof

> **Independent example, not affiliated.** Every gateway on this page is named only to identify its
> public API. AGBoss is not affiliated with, endorsed by or sponsored by any of them; their names are
> their owners' trademarks. This example follows each gateway's public documentation as read on
> 2026-11-01 (the links below). Gateways change their APIs and SDKs: check the official
> documentation before relying on it. No real gateway is called: each SDK is pointed at a local stub.

For each of ten widely used gateways, a verdict — supported or not, why, quoted from its own docs —
and, for the five supported, **the right wiring on the gateway's official SDK** (or its documented
HTTP API where it has no Node SDK), about 60 lines each, run through the failures that apply to it
against a local stub that follows that gateway's documented behaviour. Every number is read from
the stub's own records. The rule, the requirements (G1–G6) and every race:
[Payments](https://github.com/agbossjs/agboss/wiki/Payments),
[Payment gateways](https://github.com/agbossjs/agboss/wiki/Payment-gateways) and
[Payment scenarios](https://github.com/agbossjs/agboss/wiki/Payment-scenarios) on the Wiki; every
race done wrong and done right: the full example, [`11-safe-payments`](../11-safe-payments/).

## The ten gateways

**The support rule:** a gateway is supported when its public docs show an idempotency key (G1) on
every money-moving operation used, and a way to learn the outcome of a request whose answer was lost
(G2): a read by a key, a reference or an id held before money moves, or a replay of the key inside a
**documented** retention (then support ends with that retention). A refusing duplicate check with no
documented machine-readable answer is not a key; closed docs are not supported. Read on **2026-11-01**.

| Gateway | Verdict | Why | The docs it rests on (read 2026-11-01) | Example |
| --- | --- | --- | --- | --- |
| **Stripe** | **Supported** | A key on every POST, kept at least 24 h; a repeat replays the first answer; changed parameters refused; a lookup by your `metadata` (it lags) and by id | "For API v1, all `POST` requests accept idempotency keys." "Stripe retains keys for at least 24 hours" — [idempotent requests](https://docs.stripe.com/api/idempotent_requests), [low-level errors](https://docs.stripe.com/error-low-level#idempotency) | [`stripe`](./src/gateways/stripe/) |
| **Adyen** | **Supported, for 7 days** | A key on every POST, kept 7 to 14 days, the first response on a repeat; no read API for payments, so past 7 days a lost answer stays unknown | "Idempotency keys are valid for a period of 7 to 14 days after first submission." — [API idempotency](https://docs.adyen.com/development-resources/api-idempotency), [Checkout API v72](https://docs.adyen.com/api-explorer/Checkout/72/overview) | [`adyen`](./src/gateways/adyen/) |
| **PayPal** | **Supported** | `PayPal-Request-Id` on create order, capture and refund; the order id exists before money moves, and the order's GET shows its captures and refunds | "PayPal returns the latest status of the previous request that used that same header." — [idempotency](https://developer.paypal.com/api/rest/reference/idempotency/), [Orders v2](https://developer.paypal.com/docs/api/orders/v2/) | [`paypal`](./src/gateways/paypal/) |
| **Braintree** | **Not supported** | The server API reference documents no idempotency key (it appears only in SDK changelogs and source); its duplicate check refuses a repeat (30 s by default, can be switched off) instead of replaying it | Suspected duplicates "will be Gateway Rejected", the window "set to 30 seconds by default" — [transaction.sale](https://developer.paypal.com/braintree/docs/reference/request/transaction/sale/node), [duplicate checking](https://developer.paypal.com/braintree/articles/control-panel/transactions/duplicate-checking) | none |
| **Checkout.com** | **Supported** | `Cko-Idempotency-Key` on payments, captures, refunds and voids, kept 72 h; a repeat replays a 2xx answer; a lookup by your `reference` and by id | Keys expire "after 72 hours for both the sandbox and production environments"; for a 4xx or 5xx original "we don't save an idempotent result" — [idempotency](https://www.checkout.com/docs/developer-resources/api/idempotency), [list payments](https://www.checkout.com/docs/payments/manage-payments/get-a-list-of-payments) | [`checkout-com`](./src/gateways/checkout-com/) |
| **Square** | **Not supported** | A key on create and refund, with a conflict on changed parameters, but no lookup by the key or by `reference_id` and no stated retention, so a replay cannot stand in for a lookup; capture and void take no key | "If you retry the call using the same idempotency key and change any of the request details, you get a `400 Bad Request`"; list payments filters by time, location, amount and card, not by `reference_id` — [using the REST API](https://developer.squareup.com/docs/build-basics/general-considerations/using-rest-api), [list payments](https://developer.squareup.com/reference/square/payments-api/list-payments) | none |
| **Tranzila** | **Not supported** | Its duplicate check (`DCdisable`) is documented for sales only, for 24 h, skipped after a failed first attempt, and answers a repeat with a message for the customer: no replay, no documented error code | "The check in our DB will be performed up to 24 hours back." "If a transaction fails the first time, no check will be performed for it on DCdisable." — [Tranzila API](https://docs.tranzila.com/docs/payments-and-billing/tranzila-api) | none |
| **CardCom** | **Supported, for charges** | `ExternalUniqTranId` on Do Transaction replays the original answer and `GetTransactionByExternalUniqTran` finds it; refunds take no key, so a refund whose answer is lost stays unknown | On `ExternalUniqUniqTranIdResponse`: "true - לא יחייב את הכרטיס, אבל יחזיר את התגובה המקורית של העסקה" ("it will not charge the card, but returns the original response") — [API v11](https://secure.cardcom.solutions/api/v11/docs), [Do Transaction (Hebrew)](https://kb.cardcom.solutions/apijosn/he/articles/508/do-transaction-token-charge-direct-interface), [preventing duplicates (Hebrew)](https://kb.cardcom.solutions/apijosn/he/articles/509/prevent-duplicate-token-transactions) | [`cardcom`](./src/gateways/cardcom/) |
| **Grow** (formerly Meshulam) | **Not supported** | `transactionUniqueIdentifier` (token charges only) refuses a reused id whatever the first's status, with no documented error code; the lookup's answer is not documented; refunds, captures and the hosted page take no key | "the current request will be rejected outright regardless of the status of the first request with this ID" — [create transaction with token](https://developers.grow.business/reference/create-transaction-with-token) | none |
| **PayPlus** | **Not supported** | No idempotency key on any money-moving call; `more_info` is stored, not enforced unique | `more_info`: "Additional search criteria to find transactions based on extra info" — [transactions view](https://docs.payplus.co.il/reference/post_transactions-view) | none |

## 1. Engineering Promises Tested

| Promise | Threat / Failure Injected | AGBoss Mechanism | Executable Proof |
|---|---|---|---|
| **A lost answer is never charged again, on each gateway's own SDK** | The gateway charges and the connection drops (ps1); a crash before the answer (ps5); the answer in flight while the holder freezes (ps2) | An outbound call per operation under a business key, `call.idempotencyKey` (or its digest) given to the SDK, `reconcile` by the gateway's own lookup | [`tests/gateways/*.test.ts`](./tests/gateways/) › "ps1 … charges once", "ps5 …" |
| **Two executions, one charge** | The first charge still at the gateway when the second starts (ps8) | The business key: `OutboundCallInFlightError` | › "ps8 …" |
| **A key past its retention** | The repeat 25 h (Stripe), 7 h (PayPal), 73 h (Checkout.com) or 7 days (Adyen) later (ps17) | AGBoss's own stored receipt; an error of unknown outcome reconciled, never resent blindly (#657); reconcile by a lookup that does not expire; a replay-only lookup's `notSent()` sent only inside the declared `keyRetention` (#658) | › "ps17a", "ps17b", "ps17c", "ps17d" — each exactly once |
| **One refund, one capture, one webhook** | A refund's answer lost and the refund asked again (ps19); shipment 2 captured twice (ps18); Adyen's REFUND webhook delivered twice (ps15); two requests under one key at once (ps23) | `refund:<payment>:<n>`, `capture:<payment>:<n>`, a fenced effect under the event's own id | › "ps19", "ps18", "ps15", "ps23" |
| **The stubs follow the docs** | A stub that disagreed with its gateway's docs | each stub's documented behaviour, tested | [`tests/gateways/stubs.test.ts`](./tests/gateways/stubs.test.ts) |

## 2. Commands

```bash
npm ci
npm run demo     # every supported gateway × its scenarios → charges / captures / refunds from the stubs' records
npm test         # the same, asserted; the stubs against their docs; the README and the wiring's size
npm run check    # agboss check + tsc + eslint
```

Offline and $0: no key, no network beyond `127.0.0.1`, no sandbox. The SDKs are pinned exactly:
`stripe@23.1.0`, `@adyen/api-library@32.2.0`, `@paypal/paypal-server-sdk@2.5.0`,
`checkout-sdk-node@5.8.0`.

## 3. Layout

```
src/gateway-payments.ts                         the money's one service: charge, refund, capture
src/gateways/<slug>/<slug>.gateway-payments.ts  the wiring to copy: about 60 lines on the official SDK
src/gateways/<slug>/stub/                       a local stub of that gateway's documented behaviour
src/gateways/<slug>/README.md                   the notice, the verdict, the SDK, the boundary, the docs
src/stub-kit/stub-kit.ts                        the stubs' shared machinery: faults, holds, keys, records
scenarios/                                      the scenarios of 11-safe-payments that apply, per gateway
```

## 4. Guarantee Boundary

- **The verdicts rest on the docs as read on 2026-11-01.** A gateway that changes its docs can
  change its row; the stubs say `UNVERIFIED` where the docs are silent and model it conservatively.
- **Unknown outcomes and expired keys, guaranteed:** an error of unknown outcome is reconciled,
  never resent blindly ([#657](https://github.com/agbossjs/agboss/issues/657): Checkout.com ps17 c,
  CardCom ps19 — one charge, one refund), and a replay past the gateway's key retention is never
  sent ([#658](https://github.com/agbossjs/agboss/issues/658): the Stripe and Adyen wirings declare
  `NotSentTrust.KeyReplay` with its `keyRetention`, the others `NotSentTrust.Lookup` — every call says
  which, [#795](https://github.com/agbossjs/agboss/issues/795); Adyen ps17 d). Each is asserted exactly once.
- **What stays the gateway's:** keeping keys (Adyen 7 days, Checkout.com 72 h, Stripe 24 h,
  PayPal's orders 6 h), protecting a concurrent duplicate (CardCom does not: ps23), signing webhooks.
- **What stays the application's:** one business key per order and per refund, the gateway's
  `notSent` trust — `KeyReplay` with the gateway's `keyRetention` where its only lookup is a replay,
  `Lookup` where it reads a record that does not expire —, checking webhook signatures — and two rules every
  wiring here keeps: **a lookup's hit is this order's payment only when its order id (Stripe's
  `metadata.order_id`, Checkout.com's `reference`, PayPal's `reference_id`), amount and currency are
  this order's**, the search text escaped (Stripe: an order id with a quote cannot add an `OR`
  clause — the "hostile-id" row); and **a payment id a caller names refunds or captures only when the
  shop's own books tie it to that order and tenant** (`PaymentOwnershipError`, nothing sent — the
  "idor" row of every gateway). Every row of the books is a tenant's (the tenant in its key, never
  defaulted), and a webhook is applied only to the payments of the tenant its endpoint is verified
  for — Adyen's "tenancy" row.
